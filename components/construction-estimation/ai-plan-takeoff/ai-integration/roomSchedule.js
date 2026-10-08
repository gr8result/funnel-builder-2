// The takeoff's Rooms schedule: the rooms of the house, by level. It is filled by reading the room
// names lettered on the floor plans (a rooms-only request that traces nothing) and can be corrected
// by hand. It is kept in the takeoff's analysis record under `rooms`, the list the Takeoff
// Schedule's Rooms section and Client Selections' project room list already read, so every
// room-based selection (cabinetry, floor coverings, tiles, paint, ...) starts from these rooms.
// Pure functions only; requests and saving belong to useAiTakeoffAnalysis.

export const ROOMS_RUN_ID = 'rooms-from-plans-v1';
export const BUILDING_LEVELS = ['Ground Floor', 'Second Level', 'Third Level'];

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const nameKey = (value) => clean(value).toLowerCase().replace(/['’]/g, '');

// Sheets that are floor plans of a level, lowest level first: [{ page, level }].
export function floorPlanSheets(sheetLevels = {}, planPages = []) {
  const available = new Set((planPages || []).map((page) => Number(page.pageNumber)));
  return Object.entries(sheetLevels || {})
    .map(([page, level]) => ({ page: Number(page), level }))
    .filter((sheet) => Number.isInteger(sheet.page) && BUILDING_LEVELS.includes(sheet.level) && (!available.size || available.has(sheet.page)))
    .sort((a, b) => BUILDING_LEVELS.indexOf(a.level) - BUILDING_LEVELS.indexOf(b.level) || a.page - b.page);
}

// Two rooms can carry the same label (an ensuite on each level, a WC up and down). Each is a
// different room, so later ones are numbered rather than merged or dropped.
function uniquelyNamed(rooms) {
  const used = new Map();
  return rooms.map((room) => {
    const key = nameKey(room.name);
    const count = (used.get(key) || 0) + 1;
    used.set(key, count);
    if (count === 1) return room;
    let name = `${room.name} ${count}`;
    while (used.has(nameKey(name))) name = `${room.name} ${used.get(key) + 1}`;
    used.set(nameKey(name), 1);
    return { ...room, name, label: room.label || room.name };
  });
}

const sorted = (rooms) => [...rooms].sort((a, b) => BUILDING_LEVELS.indexOf(a.level) - BUILDING_LEVELS.indexOf(b.level) || a.page - b.page || a.y - b.y || a.x - b.x);

// Rooms read from the plans replace what was previously read from the same sheets. Rooms added by
// hand, and rooms read from sheets that were not read this time, are kept.
// readings: [{ page, level, rooms: [{ name, x, y, basis, confidence, evidence }] }]
export function mergeRoomReadings(existing = [], readings = []) {
  const pagesRead = new Set(readings.map((reading) => reading.page));
  const kept = (existing || []).filter((room) => room.source === 'manual' || !pagesRead.has(room.page));
  const read = readings.flatMap((reading) => (reading.rooms || [])
    .map((room) => ({ page: reading.page, level: reading.level, name: clean(room.name), x: Number(room.x) || 0, y: Number(room.y) || 0,
      basis: room.basis || 'OBSERVED', confidence: Number.isFinite(room.confidence) ? room.confidence : 0, evidence: clean(room.evidence), source: 'plan' }))
    .filter((room) => room.name && room.name.length <= 60));
  const manualNames = new Set(kept.filter((room) => room.source === 'manual').map((room) => nameKey(room.name)));
  // A room the estimator already added by hand is not added again when the plan names it too.
  return uniquelyNamed(sorted([...kept, ...read.filter((room) => !manualNames.has(nameKey(room.name)))]));
}

export function addManualRoom(existing = [], name, level, page) {
  const label = clean(name);
  if (!label || !BUILDING_LEVELS.includes(level)) return existing;
  if ((existing || []).some((room) => nameKey(room.name) === nameKey(label))) return existing;
  return sorted([...(existing || []), { page: Number(page) || 1, level, name: label, x: 0, y: 1, basis: 'OBSERVED', confidence: 1, evidence: 'Added by the estimator.', source: 'manual' }]);
}

export function removeRoom(existing = [], name) {
  return (existing || []).filter((room) => nameKey(room.name) !== nameKey(name));
}

// The analysis record with its rooms replaced. A takeoff that has never had a full AI run gets a
// record that holds the Rooms schedule and nothing else.
export function reportWithRooms(report, rooms, details = {}) {
  const base = report || { schemaVersion: 'ai-takeoff-analysis.v1', runId: ROOMS_RUN_ID, status: 'rooms', fixtures: [], documentedQuantities: [], review: [], inspections: [] };
  const scopeReview = base.scopeResult ? {
    status: 'review', completedAt: null,
    scopeResult: { ...base.scopeResult, complete: false, checklist: [
      ...(base.scopeResult.checklist || []).filter((item) => item.code !== 'rooms-changed'),
      { code: 'rooms-changed', passed: false, message: 'Rooms changed. Apply the inclusion scope again to recalculate finishes.' }
    ] }
  } : {};
  return { ...base, rooms, ...scopeReview, ...(details.readAt ? { roomsReadAt: details.readAt, roomsModel: details.model || '', roomsSheets: details.sheets || [] } : {}) };
}

// [{ level, rooms }] for display, lowest level first.
export function roomsByLevel(rooms = []) {
  return BUILDING_LEVELS.map((level) => ({ level, rooms: (rooms || []).filter((room) => room.level === level) })).filter((group) => group.rooms.length)
    .concat((rooms || []).some((room) => !BUILDING_LEVELS.includes(room.level)) ? [{ level: 'Other', rooms: rooms.filter((room) => !BUILDING_LEVELS.includes(room.level)) }] : []);
}
