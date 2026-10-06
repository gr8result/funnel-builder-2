// The project's room corrections: ADD / RENAME / REMOVE / MERGE, applied to the ONE canonical room
// list (projectLocations.js) that every Client Selections module reads. No module keeps a list.
//
//   AI Plan Takeoff / Cabinetry / Selections Book  ->  discovered rooms
//   discovered rooms + this model                  ->  canonical project rooms
//
// The model is stored on the job with the Selections Book (`book.projectRoomModel`) and mirrored onto
// the workbook. It records only what the user decided; the takeoff is never edited:
//   { version, rooms: [{ id, name, roomType, level, source, sourceKeys, removed }], updatedAt }
// id         - stable for the life of the job; a rename never changes it.
// sourceKeys - every room name this room answers to (its own, the takeoff's "Pantry" it was merged
//              from, the name it had before a rename), so a re-read of the plans cannot bring a
//              corrected room back under its old name.
// removed    - the user said this room does not exist; it stays out even though a source lists it.
//
// Modules still store their own records against a room NAME (paint overrides, tiled rooms, product
// allocations, ...). A rename or merge therefore rewrites those records in the same change
// (renameRoomRecords), so nothing is orphaned and nothing is counted twice.

import { clientSelectionCategoryForRequirement } from "./clientSelectionCategories.js";
import { plumbingLineWithTotals, plumbingLocationKey, plumbingLocationType } from "./plumbingFixtureAllocation.js";

export const PROJECT_ROOM_MODEL_VERSION = 1;
export const ROOM_SOURCE_LABELS = { takeoff: "AI Takeoff", cabinetry: "Job Setup - Cabinetry", "selections-book": "Selections Book", project: "Job Setup", manual: "Manual", imported: "Imported" };

const text = (value) => String(value ?? "").trim();
const keyOf = plumbingLocationKey;
const unique = (values) => [...new Set(values.filter(Boolean))];
const newRoomId = () => `project-room-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function projectRoomModel(book = null, workbook = null) {
  const model = book?.projectRoomModel || workbook?.projectRoomModel || null;
  return { version: PROJECT_ROOM_MODEL_VERSION, rooms: Array.isArray(model?.rooms) ? model.rooms : [], updatedAt: model?.updatedAt || "" };
}

const entryKeys = (entry = {}) => unique([...(entry.sourceKeys || []), keyOf(entry.name)]);

// Discovered rooms with the user's corrections applied: one entry per room, stable ids.
export function applyRoomModel(discovered = [], model = { rooms: [] }) {
  const byKey = new Map();
  (model.rooms || []).forEach((entry) => entryKeys(entry).forEach((key) => { if (!byKey.has(key)) byKey.set(key, entry); }));
  const emitted = new Map();
  const rooms = [];
  discovered.forEach((location) => {
    const entry = byKey.get(location.key);
    if (!entry) { rooms.push(location); return; }
    if (entry.removed) return;
    const existing = emitted.get(entry.id);
    // Two discovered rooms the user merged are one room; it keeps the takeoff's own room key.
    if (existing) { if (location.roomKey && !existing.roomKey) existing.roomKey = location.roomKey; return; }
    const room = { ...location, id: entry.id, key: keyOf(entry.name), name: entry.name, type: plumbingLocationType(entry.name), source: entry.source || location.source, roomType: entry.roomType || location.roomKey || "", level: entry.level || "" };
    emitted.set(entry.id, room);
    rooms.push(room);
  });
  // Rooms the user added that no source lists.
  (model.rooms || []).filter((entry) => !entry.removed && !emitted.has(entry.id) && text(entry.name)).forEach((entry) => {
    rooms.push({ id: entry.id, key: keyOf(entry.name), name: entry.name, type: plumbingLocationType(entry.name), source: entry.source || "manual", roomType: entry.roomType || "", level: entry.level || "" });
  });
  return rooms;
}

export function removedProjectRooms(model = { rooms: [] }) {
  return (model.rooms || []).filter((entry) => entry.removed);
}

const stamped = (model, rooms, now) => ({ version: PROJECT_ROOM_MODEL_VERSION, rooms, updatedAt: now });
// The model entry for a listed room; a room no one has corrected yet gets one that keeps its id.
function adopt(model, location) {
  const found = (model.rooms || []).find((entry) => entry.id === location.id);
  if (found) return { rooms: model.rooms, entry: found };
  const entry = { id: location.id, name: location.name, roomType: location.roomType || location.roomKey || "", level: location.level || "", source: location.source || "manual", sourceKeys: [location.key] };
  return { rooms: [...(model.rooms || []), entry], entry };
}

// Each returns { model } or { error }. `rooms` is the current canonical list.
export function addProjectRoom(model, rooms = [], { name = "", roomType = "", level = "" } = {}, now = new Date().toISOString()) {
  const label = text(name).replace(/\s+/g, " ");
  const key = keyOf(label);
  if (!key) return { error: "Enter a room name." };
  if (rooms.some((room) => room.key === key)) return { error: `${label} is already in the project.` };
  // Adding a room back clears an earlier removal of the same name.
  const kept = (model.rooms || []).filter((entry) => !(entry.removed && entryKeys(entry).includes(key)));
  return { model: stamped(model, [...kept, { id: newRoomId(), name: label, roomType: text(roomType), level: text(level), source: "manual", sourceKeys: [key], createdAt: now }], now) };
}

export function renameProjectRoom(model, rooms = [], location, name = "", now = new Date().toISOString()) {
  const label = text(name).replace(/\s+/g, " ");
  const key = keyOf(label);
  if (!key) return { error: "Enter a room name." };
  if (rooms.some((room) => room.id !== location.id && room.key === key)) return { error: `${label} is already a room in this project. Use Merge to combine the two.` };
  const adopted = adopt(model, location);
  return { model: stamped(model, adopted.rooms.map((entry) => (entry.id === location.id ? { ...entry, name: label, sourceKeys: unique([...(entry.sourceKeys || []), key]) } : entry)), now) };
}

export function updateProjectRoom(model, location, { roomType, level } = {}, now = new Date().toISOString()) {
  const adopted = adopt(model, location);
  return { model: stamped(model, adopted.rooms.map((entry) => (entry.id === location.id ? { ...entry, ...(roomType === undefined ? {} : { roomType: text(roomType) }), ...(level === undefined ? {} : { level: text(level) }) } : entry)), now) };
}

export function removeProjectRoom(model, location, now = new Date().toISOString()) {
  const adopted = adopt(model, location);
  return { model: stamped(model, adopted.rooms.map((entry) => (entry.id === location.id ? { ...entry, removed: true, removedAt: now } : entry)), now) };
}

export function restoreProjectRoom(model, entryId, now = new Date().toISOString()) {
  return { model: stamped(model, (model.rooms || []).map((entry) => (entry.id === entryId ? { ...entry, removed: false, removedAt: "" } : entry)), now) };
}

// MERGE `from` INTO `into`: `into` stays the room; it now also answers to every name `from` had.
export function mergeProjectRooms(model, from, into, now = new Date().toISOString()) {
  if (!from || !into || from.id === into.id) return { error: "Choose a different room to merge into." };
  const withFrom = adopt(model, from);
  const withBoth = adopt({ rooms: withFrom.rooms }, into);
  const absorbed = entryKeys(withFrom.entry);
  return { model: stamped(model, withBoth.rooms.filter((entry) => entry.id !== from.id).map((entry) => (entry.id === into.id ? { ...entry, sourceKeys: unique([...(entry.sourceKeys || []), ...absorbed]) } : entry)), now) };
}

// ---- Records the modules hold against a room ---------------------------------------------------
const guidedRows = (book = {}) => (book?.rooms || []).flatMap((room) => room.rows || []).filter((row) => row?.guidedSelection);
const mapGuided = (book, change) => ({
  ...book,
  rooms: (book?.rooms || []).map((room) => ({ ...room, rows: (room.rows || []).map((row) => {
    if (!row?.guidedSelection) return row;
    const next = change(row.guidedSelection, row);
    return next === row.guidedSelection ? row : { ...row, guidedSelection: next };
  }) })),
});
const sameRoom = (name, key) => keyOf(name) === key;
// "Ensuite Shower", "Bathroom Bath": a fixture position inside a room is recorded as its own
// location named after the room. It belongs to the room unless it is itself a project room.
const within = (locationKey = "", roomKey = "", otherKeys = new Set()) => locationKey === roomKey || (locationKey.startsWith(`${roomKey}-`) && !otherKeys.has(locationKey));
const electricalRoomHasData = (room = {}) => Object.keys(room.points || {}).length > 0 || (room.custom || []).length > 0 || Boolean(room.notes) || Boolean(room.status);
const electricalMatches = (room, location) => (room.roomId ? room.roomId === location.id : (room.roomKey || keyOf(room.room)) === location.key);

// Every room name with a module record against it - what makes a Selections Book template room real.
export function roomRecordKeys(book = {}) {
  const keys = new Set();
  guidedRows(book).forEach(({ guidedSelection: guided }) => {
    (guided.plumbingAllocation?.lines || []).forEach((line) => (line.allocations || []).forEach((allocation) => keys.add(allocation.locationKey || keyOf(allocation.location))));
    (guided.paintScheme?.overrides || []).forEach((item) => keys.add(keyOf(item.location)));
    (guided.paintScheme?.featureWalls || []).forEach((item) => keys.add(keyOf(item.location)));
    (guided.flooringAreas || []).forEach((area) => keys.add(area.locationKey || keyOf(area.name)));
    (guided.tilingRooms || []).forEach((room) => keys.add(keyOf(room.name)));
    (guided.electricalSchedule?.rooms || []).filter(electricalRoomHasData).forEach((room) => keys.add(room.roomKey || keyOf(room.room)));
  });
  keys.delete("");
  return keys;
}

// What is attached to a room, by module, for the removal warning. takeoff: { [roomKey]: count }.
export function projectRoomUsage(book = {}, location = {}, { rooms = [], takeoff = {}, sourceKeys = [] } = {}) {
  const otherKeys = new Set(rooms.filter((room) => room.id !== location.id).map((room) => room.key));
  const usage = new Set();
  guidedRows(book).forEach(({ guidedSelection: guided, guidedRequirementKey }) => {
    const requirementKey = guidedRequirementKey || guided.requirementKey || "";
    if ((guided.plumbingAllocation?.lines || []).some((line) => (line.allocations || []).some((allocation) => Number(allocation.quantity) > 0 && within(allocation.locationKey || keyOf(allocation.location), location.key, otherKeys)))) {
      usage.add(clientSelectionCategoryForRequirement(requirementKey)?.label || guided.requirementLabel || "Product selections");
    }
    if ([...(guided.paintScheme?.overrides || []), ...(guided.paintScheme?.featureWalls || [])].some((item) => sameRoom(item.location, location.key))) usage.add("Paint");
    if ((guided.flooringAreas || []).some((area) => (area.locationKey || keyOf(area.name)) === location.key)) usage.add("Flooring");
    if ((guided.tilingRooms || []).some((room) => sameRoom(room.name, location.key))) usage.add("Tiles & Stone");
    if ((guided.cabinetrySelection?.locations || []).some((item) => sameRoom(item.location || item.name, location.key))) usage.add("Cabinetry");
    if ((guided.electricalSchedule?.rooms || []).some((room) => electricalMatches(room, location) && electricalRoomHasData(room))) usage.add("Electrical");
  });
  const openings = unique([location.key, ...sourceKeys]).reduce((total, key) => total + (takeoff[key] || 0), 0);
  if (openings) usage.add(`Takeoff (${openings} window${openings === 1 ? "" : "s"} / door${openings === 1 ? "" : "s"} or measured area${openings === 1 ? "" : "s"})`);
  return [...usage];
}

// RENAME, or MERGE into a room that already exists (`merge`): every module record against `from`
// moves to `toName`. On a merge a record the target room already has is kept and the incoming
// duplicate is dropped, so no quantity is counted twice; a tiled room, floor area or cabinetry
// location that exists under both names is left as it is for the user to review.
export function renameRoomRecords(book = {}, from = {}, to = {}, { rooms = [], merge = false } = {}) {
  const fromKey = from.key;
  const toName = to.name;
  const toKey = keyOf(toName);
  if (!fromKey || !toKey) return book;
  const otherKeys = new Set(rooms.filter((room) => room.id !== from.id).map((room) => room.key));
  const moveLabel = (label = "", key = "") => (key === fromKey ? { key: toKey, label: toName } : { key: `${toKey}${key.slice(fromKey.length)}`, label: `${toName}${text(label).slice(text(from.name).length)}` });
  return mapGuided(book, (guided) => {
    let next = guided;
    if (guided.plumbingAllocation?.lines?.length) {
      let touched = false;
      const lines = guided.plumbingAllocation.lines.map((line) => {
        if (!(line.allocations || []).some((allocation) => within(allocation.locationKey || keyOf(allocation.location), fromKey, otherKeys))) return line;
        touched = true;
        const allocations = [];
        (line.allocations || []).forEach((allocation) => {
          const key = allocation.locationKey || keyOf(allocation.location);
          if (!within(key, fromKey, otherKeys)) { allocations.push(allocation); return; }
          const moved = moveLabel(allocation.location, key);
          // The target already has this product in this position: the same item, not a second one.
          if ((line.allocations || []).some((other) => other !== allocation && (other.locationKey || keyOf(other.location)) === moved.key)) return;
          allocations.push({ ...allocation, locationKey: moved.key, location: moved.label });
        });
        return plumbingLineWithTotals({ ...line, allocations });
      });
      if (touched) next = { ...next, plumbingAllocation: { ...guided.plumbingAllocation, lines } };
    }
    if (guided.paintScheme) {
      const scheme = guided.paintScheme;
      const overrides = (scheme.overrides || []).filter((item) => !(sameRoom(item.location, fromKey) && (scheme.overrides || []).some((other) => other !== item && other.surface === item.surface && sameRoom(other.location, toKey))))
        .map((item) => (sameRoom(item.location, fromKey) ? { ...item, location: toName } : item));
      const featureWalls = (scheme.featureWalls || []).map((item) => (sameRoom(item.location, fromKey) ? { ...item, location: toName } : item));
      if ([...(scheme.overrides || []), ...(scheme.featureWalls || [])].some((item) => sameRoom(item.location, fromKey))) next = { ...next, paintScheme: { ...scheme, overrides, featureWalls } };
    }
    if ((guided.flooringAreas || []).some((area) => (area.locationKey || keyOf(area.name)) === fromKey) && !(merge && guided.flooringAreas.some((area) => (area.locationKey || keyOf(area.name)) === toKey))) {
      next = { ...next, flooringAreas: guided.flooringAreas.map((area) => ((area.locationKey || keyOf(area.name)) === fromKey ? { ...area, name: toName, locationKey: toKey } : area)) };
    }
    if ((guided.tilingRooms || []).some((room) => sameRoom(room.name, fromKey)) && !(merge && guided.tilingRooms.some((room) => sameRoom(room.name, toKey)))) {
      next = { ...next, tilingRooms: guided.tilingRooms.map((room) => (sameRoom(room.name, fromKey) ? { ...room, name: toName } : room)) };
    }
    const cabinetry = guided.cabinetrySelection?.locations;
    if ((cabinetry || []).some((item) => sameRoom(item.location || item.name, fromKey)) && !(merge && cabinetry.some((item) => sameRoom(item.location || item.name, toKey)))) {
      next = { ...next, cabinetrySelection: { ...guided.cabinetrySelection, locations: cabinetry.map((item) => (sameRoom(item.location || item.name, fromKey) ? { ...item, location: toName, ...(item.name ? { name: toName } : {}) } : item)) } };
    }
    if (guided.electricalSchedule?.rooms?.some((room) => electricalMatches(room, from))) {
      const source = guided.electricalSchedule.rooms.find((room) => electricalMatches(room, from));
      const target = merge ? guided.electricalSchedule.rooms.find((room) => electricalMatches(room, to)) : null;
      const rest = guided.electricalSchedule.rooms.filter((room) => room !== source && room !== target);
      // Merged quantities: the target room's own figure stands; the incoming room fills the gaps.
      // A kept room with nothing entered simply takes the incoming room's schedule; where both had
      // quantities the combined room goes back to "in progress" for the client to confirm.
      const combined = target && !electricalRoomHasData(target)
        ? { ...source, roomId: target.roomId || to.id, roomKey: toKey, room: toName }
        : target
        ? { ...target, points: { ...source.points, ...target.points }, custom: [...(target.custom || []), ...(source.custom || []).filter((item) => !(target.custom || []).some((other) => keyOf(other.label) === keyOf(item.label)))], notes: unique([target.notes, source.notes]).join(" · "), status: electricalRoomHasData(source) ? "in_progress" : target.status, confirmedAt: electricalRoomHasData(source) ? "" : target.confirmedAt }
        : { ...source, roomId: to.id || source.roomId, roomKey: toKey, room: toName };
      next = { ...next, electricalSchedule: { ...guided.electricalSchedule, rooms: guided.electricalSchedule.rooms.flatMap((room) => (room === (target || source) ? [combined] : rest.includes(room) ? [room] : [])) } };
    }
    return next;
  });
}

// REMOVE: the room's electrical points go with it. Other modules' records are left stored but are
// no longer attached to a listed room; nothing else is deleted.
export function removeRoomRecords(book = {}, location = {}) {
  return mapGuided(book, (guided) => (guided.electricalSchedule?.rooms?.some((room) => electricalMatches(room, location))
    ? { ...guided, electricalSchedule: { ...guided.electricalSchedule, rooms: guided.electricalSchedule.rooms.filter((room) => !electricalMatches(room, location)) } }
    : guided));
}
