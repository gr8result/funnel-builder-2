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
import { canonicalSelectionLocation, isSupportedNonRoomLocation, plumbingAllocationLocationKey, plumbingLineWithTotals, plumbingLocationKey, plumbingLocationType } from "./plumbingFixtureAllocation.js";
import { isGenericBuildingLevelLocation, levelIdOf, levelLabel, mergeLevelEvidence, resolveRoomLevel } from "./buildingLevels.js";

export const PROJECT_ROOM_MODEL_VERSION = 1;
export const ROOM_SOURCE_LABELS = { takeoff: "AI Takeoff", cabinetry: "Job Setup - Cabinetry", "selections-book": "Selections Book", project: "Job Setup", manual: "Manual", imported: "Imported" };

const text = (value) => String(value ?? "").trim();
const keyOf = plumbingLocationKey;
const allocationRoomKey = plumbingAllocationLocationKey;
const unique = (values) => [...new Set(values.filter(Boolean))];
const newRoomId = () => `project-room-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function projectRoomModel(book = null, workbook = null) {
  const model = book?.projectRoomModel || workbook?.projectRoomModel || null;
  // separate: pairs of room ids confirmed as different rooms; confirmedAt: Step 1 (room setup) done; history: audit trail.
  return { version: PROJECT_ROOM_MODEL_VERSION, rooms: Array.isArray(model?.rooms) ? model.rooms : [], updatedAt: model?.updatedAt || "", ...(Array.isArray(model?.separate) ? { separate: model.separate } : {}), ...(model?.confirmedAt ? { confirmedAt: model.confirmedAt, confirmedRoomCount: model.confirmedRoomCount || 0 } : {}), ...(Array.isArray(model?.history) ? { history: model.history } : {}) };
}

const entryKeys = (entry = {}) => unique([...(entry.sourceKeys || []), keyOf(entry.name)]);

// Only explicit, unambiguous room history can reconnect a renamed room. Never infer
// identity from similar labels, or select a winner between conflicting aliases.
export function canonicalProjectRoomName(name, model = { rooms: [] }) {
  const key = keyOf(name);
  const matches = (model.rooms || []).filter(entry => !entry.removed && entryKeys(entry).includes(key));
  return matches.length === 1 ? matches[0].name : name;
}


// Discovered rooms with the user's corrections applied: one entry per room, stable ids.
// Every room also gets its level: the builder's saved choice, else the level of the plan sheet(s)
// the room was found on. A room whose evidence is missing or conflicting carries `levelReview`.
export function applyRoomModel(discovered = [], model = { rooms: [] }) {
  const byKey = new Map();
  (model.rooms || []).forEach((entry) => entryKeys(entry).forEach((key) => {
    const entries = byKey.get(key) || [];
    entries.push(entry);
    byKey.set(key, entries);
  }));
  const emitted = new Map();
  const rooms = [];
  discovered.forEach((location) => {
    const sameName = byKey.get(location.key) || [];
    const direct = sameName.find((entry) => entry.id === location.id);
    const levelMatched = location.levelEvidence?.levelIds?.length === 1
      ? sameName.filter((entry) => levelIdOf(entry.level) === location.levelEvidence.levelIds[0])
      : [];
    const oneDiscoveredName = !discovered.some((other) => other !== location && other.key === location.key);
    const savedLevelConflict = sameName.length === 1 && sameName[0].source === "manual" && location.levelEvidence?.levelIds?.length === 1 && levelIdOf(sameName[0].level) && levelIdOf(sameName[0].level) !== location.levelEvidence.levelIds[0];
    const entry = direct || (levelMatched.length === 1 ? levelMatched[0] : sameName.length === 1 && oneDiscoveredName && !savedLevelConflict ? sameName[0] : null);
    if (!entry) { rooms.push(location); return; }
    if (entry.removed) return;
    const existing = emitted.get(entry.id);
    // Two discovered rooms the user merged are one room; it keeps the takeoff's own room key.
    if (existing) {
      if (location.roomKey && !existing.roomKey) existing.roomKey = location.roomKey;
      if (location.levelEvidence) existing.levelEvidence = mergeLevelEvidence(existing.levelEvidence, location.levelEvidence);
      return;
    }
    const room = { ...location, id: entry.id, key: keyOf(entry.name), name: entry.name, type: plumbingLocationType(entry.name), source: entry.source || location.source, roomType: entry.roomType || location.roomKey || "", storedLevel: entry.level || "" };
    emitted.set(entry.id, room);
    rooms.push(room);
  });
  // Rooms the user added that no source lists.
  (model.rooms || []).filter((entry) => !entry.removed && !emitted.has(entry.id) && text(entry.name)).forEach((entry) => {
    rooms.push({ id: entry.id, key: keyOf(entry.name), name: entry.name, type: plumbingLocationType(entry.name), source: entry.source || "manual", roomType: entry.roomType || "", storedLevel: entry.level || "" });
  });
  return rooms.map(withResolvedLevel);
}

function withResolvedLevel(room) {
  const { storedLevel = "", levelEvidence = null, ...rest } = room;
  const resolved = resolveRoomLevel({ stored: storedLevel, evidence: levelEvidence });
  // A room nobody has placed on a plan (added by hand) has no evidence to be missing.
  const manual = !levelEvidence && !["takeoff"].includes(rest.source);
  return { ...rest, ...resolved, ...(manual && !resolved.levelSource ? { levelReview: "Choose the floor this room is on." } : {}) };
}

export function removedProjectRooms(model = { rooms: [] }) {
  return (model.rooms || []).filter((entry) => entry.removed);
}

const stamped = (model, rooms, now) => ({ version: PROJECT_ROOM_MODEL_VERSION, rooms, updatedAt: now, ...(Array.isArray(model?.separate) ? { separate: model.separate } : {}), ...(model?.confirmedAt ? { confirmedAt: model.confirmedAt, confirmedRoomCount: model.confirmedRoomCount || 0 } : {}), ...(Array.isArray(model?.history) ? { history: model.history } : {}) });
// The model entry for a listed room; a room no one has corrected yet gets one that keeps its id.
function adopt(model, location) {
  const found = (model.rooms || []).find((entry) => entry.id === location.id);
  if (found) return { rooms: model.rooms, entry: found };
  const entry = { id: location.id, name: location.name, roomType: location.roomType || location.roomKey || "", level: location.levelSource === "builder" ? location.level : "", source: location.source || "manual", sourceKeys: [location.key] };
  return { rooms: [...(model.rooms || []), entry], entry };
}

// Each returns { model } or { error }. `rooms` is the current canonical list.
export function addProjectRoom(model, rooms = [], { name = "", roomType = "", level = "" } = {}, now = new Date().toISOString()) {
  const label = text(name).replace(/\s+/g, " ");
  const key = keyOf(label);
  if (!key) return { error: "Enter a room name." };
  const requestedLevelId = levelIdOf(level);
  const duplicate = rooms.some((room) => room.key === key && (!requestedLevelId || !room.levelId || room.levelId === requestedLevelId));
  if (duplicate) return { error: `${label} is already in the project.` };
  // Adding a room back clears an earlier removal of the same name.
  const kept = (model.rooms || []).filter((entry) => !(entry.removed && entryKeys(entry).includes(key)));
  return { model: stamped(model, [...kept, { id: newRoomId(), name: label, roomType: text(roomType), level: text(level), source: "manual", sourceKeys: [key], createdAt: now }], now) };
}

export function renameProjectRoom(model, rooms = [], location, name = "", now = new Date().toISOString()) {
  const label = text(name).replace(/\s+/g, " ");
  const key = keyOf(label);
  if (!key) return { error: "Enter a room name." };
  if (rooms.some((room) => room.id !== location.id && room.key === key && !(location.levelId && room.levelId && location.levelId !== room.levelId))) return { error: `${label} is already a room in this project. Use Merge to combine the two.` };
  const adopted = adopt(model, location);
  return { model: stamped(model, adopted.rooms.map((entry) => (entry.id === location.id ? { ...entry, name: label, sourceKeys: unique([...(entry.sourceKeys || []), key]) } : entry)), now) };
}

export function updateProjectRoom(model, location, { roomType, level } = {}, now = new Date().toISOString()) {
  const adopted = adopt(model, location);
  // A level the builder sets is theirs: a later takeoff run never replaces it.
  return { model: stamped(model, adopted.rooms.map((entry) => (entry.id === location.id ? { ...entry, ...(roomType === undefined ? {} : { roomType: text(roomType) }), ...(level === undefined ? {} : { level: text(level), levelSource: text(level) ? "builder" : "" }) } : entry)), now) };
}

// Records levels read from plan evidence (or legacy labels with an established equivalent) on the
// rooms that need them. Only the level fields change; ids, names, keys and every selection stay.
export function setRoomLevels(model, assignments = [], now = new Date().toISOString()) {
  let rooms = model.rooms || [];
  assignments.forEach(({ room, level, levelSource, levelSheets }) => {
    rooms = adopt({ rooms }, room).rooms.map((entry) => (entry.id === room.id ? { ...entry, level, levelSource, ...(levelSheets?.length ? { levelSheets } : {}) } : entry));
  });
  return { model: { ...stamped(model, rooms, now), history: [...(model.history || []), { action: "set-levels", count: assignments.length, rooms: assignments.map(({ room, level }) => `${room.name}: ${level}`), at: now }] } };
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
  // Rooms on different floors are different rooms (an ensuite upstairs and one downstairs). Fix a wrong level first.
  if (from.levelId && into.levelId && from.levelId !== into.levelId) return { error: `${from.name} is on the ${from.level} and ${into.name} is on the ${into.level}, so they are different rooms. If one level is wrong, correct it first.` };
  const withFrom = adopt(model, from);
  const withBoth = adopt({ rooms: withFrom.rooms }, into);
  const absorbed = entryKeys(withFrom.entry);
  const merged = stamped(model, withBoth.rooms.filter((entry) => entry.id !== from.id).map((entry) => (entry.id === into.id ? { ...entry, sourceKeys: unique([...(entry.sourceKeys || []), ...absorbed]) } : entry)), now);
  return { model: { ...merged, history: [...(merged.history || []), { action: "merge", from: from.name, into: into.name, at: now }] } };
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
    (guided.plumbingAllocation?.lines || []).forEach((line) => (line.allocations || []).forEach((allocation) => keys.add(keyOf(allocation.roomName || allocation.location))));
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
    if ((guided.plumbingAllocation?.lines || []).some((line) => (line.allocations || []).some((allocation) => Number(allocation.quantity) > 0 && (allocation.locationId === location.id || within(allocationRoomKey(allocation), location.key, otherKeys))))) {
      usage.add(clientSelectionCategoryForRequirement(requirementKey)?.label || guided.requirementLabel || "Product selections");
    }
    if ([...(guided.paintScheme?.overrides || []), ...(guided.paintScheme?.featureWalls || [])].some((item) => sameRoom(item.location, location.key))) usage.add("Paint");
    if ((guided.flooringAreas || []).some((area) => (area.locationKey || keyOf(area.name)) === location.key)) usage.add("Flooring");
    if ((guided.tilingRooms || []).some((room) => sameRoom(room.name, location.key))) usage.add("Tiles & Stone");
    if ((guided.cabinetrySelection?.locations || []).some((item) => sameRoom(item.location || item.name, location.key))) usage.add("Cabinetry");
    if ((guided.electricalSchedule?.rooms || []).some((room) => electricalMatches(room, location) && electricalRoomHasData(room))) usage.add("Electrical");
  });
  const floorCount = location.identityKey && location.identityKey !== location.key ? takeoff[location.identityKey] : null;
  const directEvidence = floorCount ?? unique([location.key, ...sourceKeys]).flatMap((key) => Array.isArray(takeoff[key]) ? takeoff[key] : []);
  if (Array.isArray(directEvidence) && directEvidence.length) {
    const seen = new Set();
    directEvidence.forEach((record) => {
      const evidenceKey = `${record.sourceReference}|${record.recordId}`;
      if (seen.has(evidenceKey)) return;
      seen.add(evidenceKey);
      const where = [record.floor, record.page ? `page ${record.page}` : ""].filter(Boolean).join(", ");
      usage.add(`Takeoff — ${record.classification} ${record.recordId} (${record.sourceReference}); assigned room ${record.assignedRoomId || "not recorded"}${where ? `; ${where}` : ""}; evidence: ${record.sourceEvidence}.`);
    });
  } else {
    const count = Number(floorCount) || unique([location.key, ...sourceKeys]).reduce((total, key) => total + (Number(takeoff[key]) || 0), 0);
    if (count) usage.add(`Takeoff (${count} associated record${count === 1 ? "" : "s"}; details unavailable)`);
  }
  return [...usage];
}

// RENAME, or MERGE into a room that already exists (`merge`): every module record against `from`
// moves to `toName`. On a merge a record the target room already has is kept and the incoming
// duplicate is dropped, so no quantity is counted twice; a tiled room, floor area or cabinetry
// location that exists under both names is left as it is for the user to review.
// resolutions: { [conflict id from roomMergeConflicts]: "same" | "both" | "keep-target" }.
//   same        - one item recorded under both names: the target's allocation stands.
//   both        - two items: both are kept (the quantities are added for the same product).
//   keep-target - a different product in each room: the incoming one is not moved.
// Callers show the conflicts and ask first; an unanswered collision of the same product adds nothing.
export function renameRoomRecords(book = {}, from = {}, to = {}, { rooms = [], merge = false, resolutions = {} } = {}) {
  const fromKey = from.key;
  const toName = to.name;
  const toKey = keyOf(toName);
  if (!fromKey || !toKey) return book;
  const otherKeys = new Set(rooms.filter((room) => room.id !== from.id).map((room) => room.key));
  const moveLabel = (label = "", key = "") => (key === fromKey ? { key: toKey, label: toName } : { key: `${toKey}${key.slice(fromKey.length)}`, label: `${toName}${text(label).slice(text(from.name).length)}` });
  return mapGuided(book, (guided, row) => {
    let next = guided;
    const requirementKey = row?.guidedRequirementKey || guided.requirementKey || "";
    const answer = (line, existingLine, position) => resolutions[`${requirementKey}|${line.lineId || line.productName}|${existingLine.lineId || existingLine.productName}|${position}`] || "";
    if (guided.plumbingAllocation?.lines?.length) {
      let touched = false;
      const keyOfAllocation = allocationRoomKey;
      const belongsTo = (allocation) => allocation.locationId === from.id || (!allocation.locationId && within(keyOfAllocation(allocation), fromKey, otherKeys));
      // Another product line of this requirement already in the target position.
      const rivalAt = (line, key) => guided.plumbingAllocation.lines.find((other) => other !== line && (other.allocations || []).some((allocation) => Number(allocation.quantity) > 0 && keyOfAllocation(allocation) === key));
      const lines = guided.plumbingAllocation.lines.map((line) => {
        if (!(line.allocations || []).some(belongsTo)) return line;
        touched = true;
        // What stays where it is, then what moves in.
        const allocations = (line.allocations || []).filter((allocation) => !belongsTo(allocation));
        (line.allocations || []).filter(belongsTo).forEach((allocation) => {
          const key = keyOfAllocation(allocation);
          const moved = moveLabel(allocation.location, key);
          const position = key.slice(fromKey.length);
          const targetKey = to.identityKey || moved.key;
          const index = allocations.findIndex((other) => other.locationId === to.id || keyOfAllocation(other) === targetKey);
          if (index >= 0) {
            // The target already has this product in this position: one item unless the builder said two.
            if (merge && answer(line, line, position) === "both") allocations[index] = { ...allocations[index], quantity: (Number(allocations[index].quantity) || 0) + (Number(allocation.quantity) || 0) };
            return;
          }
          // The target has another product line in this position.
          const rival = merge ? rivalAt(line, targetKey) : null;
          const decided = rival ? answer(line, rival, position) : "";
          if (rival && (decided === "keep-target" || (decided !== "both" && rival.productId && rival.productId === line.productId))) return;
          const levelIdentity = Boolean(to.levelId || to.identityKey && to.identityKey !== to.key);
          allocations.push({
            ...allocation,
            locationKey: targetKey,
            ...(levelIdentity ? { locationId: to.id, locationKey: targetKey, roomName: to.name, levelId: to.levelId || "" } : {}),
            location: levelIdentity ? (to.displayName || moved.label) : moved.label,
          });
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
    if ((cabinetry || []).some((item) => sameRoom(item.location || item.name, fromKey))) {
      const moveLine = (line) => sameRoom(line.location, fromKey) ? { ...line, location: toName } : line;
      const uniqueLines = (lines = []) => {
        const seen = new Set();
        return lines.map(moveLine).filter((line) => {
          const identity = line.componentId || `${keyOf(line.location)}|${keyOf(line.unitType || line.type)}|${Number(line.quantity) || 0}`;
          if (seen.has(identity)) return false;
          seen.add(identity);
          return true;
        });
      };
      const selection = guided.cabinetrySelection;
      const source = cabinetry.find((item) => sameRoom(item.location || item.name, fromKey));
      const target = merge ? cabinetry.find((item) => sameRoom(item.location || item.name, toKey)) : null;
      let locations;
      if (target) {
        const sourceSchedule = (source.cabinetSchedule || []).map(moveLine);
        const targetSchedule = (target.cabinetSchedule || []).map(moveLine);
        const mergedLocation = {
          ...source,
          ...target,
          location: toName,
          ...(target.name || source.name ? { name: toName } : {}),
          areaSelections: { ...(source.areaSelections || {}), ...(target.areaSelections || {}) },
          handles: { ...(source.handles || {}), ...(target.handles || {}) },
          bathroomBenchtops: { ...(source.bathroomBenchtops || {}), ...(target.bathroomBenchtops || {}) },
          enabledAreaKeys: unique([...(source.enabledAreaKeys || []), ...(target.enabledAreaKeys || [])]),
          scope: unique([...(source.scope || []), ...(target.scope || [])]),
          cabinetSchedule: uniqueLines([...targetSchedule, ...sourceSchedule]),
        };
        locations = cabinetry.flatMap((item) => {
          if (item === source) return [];
          if (item === target) return [mergedLocation];
          return [item];
        });
      } else {
        locations = cabinetry.map((item) => (sameRoom(item.location || item.name, fromKey) ? {
          ...item,
          location: toName,
          ...(item.name ? { name: toName } : {}),
          ...(Array.isArray(item.cabinetSchedule) ? { cabinetSchedule: item.cabinetSchedule.map(moveLine) } : {}),
        } : item));
      }
      next = { ...next, cabinetrySelection: {
        ...selection,
        locations,
        ...(Array.isArray(selection.schedule) ? { schedule: uniqueLines(selection.schedule) } : {}),
        ...(Array.isArray(selection.legacyCabinetSchedule) ? { legacyCabinetSchedule: uniqueLines(selection.legacyCabinetSchedule) } : {}),
      } };
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

export function assignSelectionAllocationToRoom(book = {}, from = {}, to = {}, detail = {}, requestedQuantity = 1) {
  const fromKey = from.key;
  const targetKey = to.identityKey || keyOf(to.name);
  const quantity = Math.max(0, Number(requestedQuantity) || 0);
  if (!fromKey || !targetKey || !to.id || !quantity) return book;
  return mapGuided(book, (guided, row) => {
    const requirementKey = row?.guidedRequirementKey || guided.requirementKey || "";
    if (detail.requirementKey && detail.requirementKey !== requirementKey) return guided;
    if (!guided.plumbingAllocation?.lines?.length) return guided;
    let touched = false;
    const lines = guided.plumbingAllocation.lines.map((line) => {
      if (detail.lineId && line.lineId !== detail.lineId) return line;
      if (detail.productId && line.productId !== detail.productId) return line;
      let remaining = quantity;
      let moved = 0;
      let source = null;
      const allocations = [];
      (line.allocations || []).forEach((allocation) => {
        const available = Number(allocation.quantity) || 0;
        if (remaining <= 0 || allocationRoomKey(allocation) !== fromKey || available <= 0) {
          allocations.push(allocation);
          return;
        }
        const moving = Math.min(available, remaining);
        source ||= allocation;
        moved += moving;
        remaining -= moving;
        if (available > moving) allocations.push({ ...allocation, quantity: available - moving });
      });
      if (!moved || !source) return line;
      const targetIndex = allocations.findIndex((allocation) => allocation.locationId === to.id || allocationRoomKey(allocation) === targetKey);
      if (targetIndex >= 0) {
        allocations[targetIndex] = { ...allocations[targetIndex], quantity: (Number(allocations[targetIndex].quantity) || 0) + moved };
      } else {
        const { assignmentReviewRequired, legacyLocation, ...preserved } = source;
        allocations.push({
          ...preserved,
          locationId: to.id,
          locationKey: targetKey,
          roomName: to.name,
          levelId: to.levelId || "",
          location: to.displayName || to.name,
          quantity: moved,
        });
      }
      touched = true;
      return plumbingLineWithTotals({ ...line, allocations });
    });
    return touched ? { ...guided, plumbingAllocation: { ...guided.plumbingAllocation, lines } } : guided;
  });
}

function reconcileFloorSelectionAllocation(book = {}, from = {}, detail = {}, action = "remove-duplicate") {
  const fromKey = from.key;
  const quantity = Math.max(0, Number(detail.quantity) || 0);
  if (!fromKey || !quantity) return book;
  return mapGuided(book, (guided, row) => {
    const requirementKey = row?.guidedRequirementKey || guided.requirementKey || "";
    if (detail.requirementKey && detail.requirementKey !== requirementKey) return guided;
    const currentLines = guided.plumbingAllocation?.lines || [];
    let reconciled = 0;
    const lines = currentLines.map((line) => {
      if (detail.lineId && line.lineId !== detail.lineId) return line;
      if (detail.productId && line.productId !== detail.productId) return line;
      let remaining = quantity;
      const allocations = [];
      let source = null;
      (line.allocations || []).forEach((allocation) => {
        const available = Number(allocation.quantity) || 0;
        if (remaining <= 0 || allocationRoomKey(allocation) !== fromKey || available <= 0) {
          allocations.push(allocation);
          return;
        }
        const amount = Math.min(available, remaining);
        source ||= allocation;
        reconciled += amount;
        remaining -= amount;
        if (available > amount) allocations.push({ ...allocation, quantity: available - amount });
      });
      if (action === "keep-floor-additional-unallocated" && reconciled && source) {
        const existing = allocations.findIndex((allocation) => allocationRoomKey(allocation) === "unallocated");
        if (existing >= 0) {
          allocations[existing] = { ...allocations[existing], quantity: (Number(allocations[existing].quantity) || 0) + reconciled };
        } else {
          const { assignmentReviewRequired, legacyLocation, levelId, locationId, roomName, ...preserved } = source;
          allocations.push({
            ...preserved,
            locationKey: "unallocated",
            location: "Unallocated",
            quantity: reconciled,
            additional: true,
            intendedLevelId: from.levelId || levelId || "",
            historicalFloorLocation: legacyLocation || from.name,
          });
        }
      }
      return reconciled ? plumbingLineWithTotals({ ...line, allocations }) : line;
    });
    if (!reconciled) return guided;
    return {
      ...guided,
      plumbingAllocation: { ...guided.plumbingAllocation, lines },
      allocationReconciliationHistory: [
        ...(guided.allocationReconciliationHistory || []),
        {
          action,
          requirementKey,
          productId: detail.productId || "",
          lineId: detail.lineId || "",
          productName: detail.productName || "",
          sourceLocation: from.name,
          sourceLevelId: from.levelId || "",
          quantity: reconciled,
          duplicateProven: detail.duplicateProven === true,
          roomEvidence: detail.roomEvidence || [],
          at: new Date().toISOString(),
        },
      ],
    };
  });
}

export function removeDuplicateSelectionAllocation(book = {}, from = {}, detail = {}) {
  return reconcileFloorSelectionAllocation(book, from, detail, "remove-floor-duplicate");
}

export function keepSelectionAllocationUnallocated(book = {}, from = {}, detail = {}) {
  return reconcileFloorSelectionAllocation(book, from, detail, "keep-floor-additional-unallocated");
}

// REMOVE: the room's electrical points go with it. Other modules' records are left stored but are
// no longer attached to a listed room; nothing else is deleted.
export function removeRoomRecords(book = {}, location = {}) {
  return mapGuided(book, (guided) => (guided.electricalSchedule?.rooms?.some((room) => electricalMatches(room, location))
    ? { ...guided, electricalSchedule: { ...guided.electricalSchedule, rooms: guided.electricalSchedule.rooms.filter((room) => !electricalMatches(room, location)) } }
    : guided));
}

// ---- Room setup: review before selecting ---------------------------------------------------------
// Nothing below merges anything. It finds what a builder should look at; the builder decides.

// "Bed 2 Ensuite", "B2 Ensuite", "2nd Bedroom Ensuite" -> the same words. Only used to SUGGEST that
// two names may be one room.
const ROOM_WORDS = [[/\b(2nd|second)\b/g, "2"], [/\b(1st|first)\b/g, "1"], [/\b(3rd|third)\b/g, "3"], [/\bb(?:ed)?\s*(\d)\b/g, "bedroom $1"], [/\bbed\b/g, "bedroom"], [/\bens\b/g, "ensuite"], [/\bbutler'?s?\b/g, ""], [/\b(main|master|the)\b/g, ""],
  [/\b(wc|w\.c\.|toilet|powder room|powder)\b/g, "powder"], [/\bwalk[- ]?in[- ]?robe\b/g, "wir"], [/\bbathroom\b/g, "bath"]];
function roomWords(name = "") {
  let value = text(name).toLowerCase().replace(/['’]/g, "'");
  ROOM_WORDS.forEach(([pattern, replacement]) => { value = value.replace(pattern, replacement); });
  // "bedroom 2 ensuite" and "2 bedroom ensuite" are the same words.
  return value.split(/[^a-z0-9]+/).filter(Boolean).sort();
}
const sameWords = (left, right) => left.length > 0 && left.length === right.length && left.every((word, index) => word === right[index]);
const pairKey = (left, right) => [left, right].sort().join("|");
const separated = (model = {}) => new Set((model.separate || []).map(([left, right]) => pairKey(left, right)));

// Pairs of listed rooms that may be one room: [{ rooms: [a, b], reason }]. A pair the builder has
// confirmed as two separate rooms is not offered again.
export function possibleDuplicateRooms(rooms = [], model = { rooms: [] }) {
  const kept = separated(model);
  const pairs = [];
  rooms.forEach((room, index) => rooms.slice(index + 1).forEach((other) => {
    if (kept.has(pairKey(room.id, other.id))) return;
    // The same name on two known floors is two rooms, not a duplicate.
    if (room.levelId && other.levelId && room.levelId !== other.levelId) return;
    const left = roomWords(room.name), right = roomWords(other.name);
    const QUALIFIERS = new Set(["room", "area", "space", "upper", "lower", "ground", "level", "floor", "upstairs", "downstairs", "guest", "family", "kids", "front", "rear"]);
    const contained = (small, big) => small.length < big.length && small.every((word) => big.includes(word)) && big.filter((word) => !small.includes(word)).every((word) => QUALIFIERS.has(word));
    const reason = sameWords(left, right) ? "These names describe the same room in different words."
      : contained(left, right) || contained(right, left) ? "One name is a shorter form of the other."
      : "";
    if (reason) pairs.push({ rooms: [room, other], reason });
  }));
  return pairs;
}

// The builder confirmed these are two different rooms.
export function keepRoomsSeparate(model, left, right, now = new Date().toISOString()) {
  if (!left?.id || !right?.id || left.id === right.id) return { error: "Choose two different rooms." };
  const pairs = (model.separate || []).filter(([a, b]) => pairKey(a, b) !== pairKey(left.id, right.id));
  return { model: { ...stamped(model, model.rooms || [], now), separate: [...pairs, [left.id, right.id]], history: [...(model.history || []), { action: "keep-separate", rooms: [left.name, right.name], at: now }] } };
}

// Step 1 is done: the builder has confirmed this room list.
export function confirmProjectRooms(model, rooms = [], now = new Date().toISOString()) {
  // Levels read from the plan sheets are written into the model now, so they stay as confirmed
  // even if the takeoff is later re-run. A level the builder already chose is never touched.
  let working = model.rooms || [];
  const stamps = rooms.filter((room) => room.levelSource === "takeoff-sheet" && room.levelId);
  stamps.forEach((room) => { working = adopt({ rooms: working }, room).rooms.map((entry) => (entry.id === room.id && !text(entry.level) ? { ...entry, level: room.level, levelSource: "takeoff-sheet", levelSheets: room.levelSheets || [] } : entry)); });
  return { model: { ...stamped(model, working, now), ...(model.separate ? { separate: model.separate } : {}), confirmedAt: now, confirmedRoomCount: rooms.length, history: [...(model.history || []), { action: "confirm-rooms", rooms: rooms.map((room) => room.name), levelsFromPlans: stamps.length, levelsToReview: rooms.filter((room) => room.levelReview).length, at: now }] } };
}
export const projectRoomsConfirmed = (model = {}) => Boolean(model?.confirmedAt);

// Location names selections are stored against that are NOT project rooms (and are not a fixture
// position inside one, like "Ensuite Shower"): [{ id, key, name, usedBy, suggestion }]. These are
// where duplicates come from - "2nd BEDROOM ENSUITE" typed in one module while the plans call the
// room "B2 Ensuite" - and a room manager that lists only project rooms can never fix them.
export function unlistedSelectionLocations(book = {}, rooms = [], model = { rooms: [] }) {
  // A name a room already answers to (it was merged or renamed) is that room.
  const roomKeys = new Set([...rooms.map((room) => room.key), ...(model.rooms || []).filter((entry) => !entry.removed).flatMap(entryKeys)]);
  const inside = (key) => roomKeys.has(key) || [...roomKeys].some((roomKey) => key.startsWith(`${roomKey}-`));
  const found = new Map();
  const note = (name, key, usedBy, locationId = "", detail = null) => {
    if (locationId && rooms.some((room) => room.id === locationId)) return;
    const canonical = canonicalSelectionLocation(name);
    if (canonical.locationType && isSupportedNonRoomLocation(canonical.location)) return;
    if (isSupportedNonRoomLocation(canonical.location) && canonical.locationKey === plumbingLocationType(canonical.location)) return;
    const levelId = canonical.levelId || (isGenericBuildingLevelLocation(name) ? levelIdOf(name) : "");
    const locationKey = levelId ? canonical.locationKey : key || keyOf(name);
    if (!locationKey || locationKey === "unallocated" || inside(locationKey)) return;
    const entry = found.get(locationKey) || { id: `unlisted-${locationKey}`, key: locationKey, name: levelId ? levelLabel(levelId) : canonical.location || text(name), usedBy: [], details: [], unlisted: true, ...(levelId ? { levelId, floorAllocation: true, legacyNames: [] } : {}) };
    if (!entry.usedBy.includes(usedBy)) entry.usedBy.push(usedBy);
    if (levelId && text(name) && !entry.legacyNames.includes(text(name))) entry.legacyNames.push(text(name));
    if (detail && !entry.details.some((item) => item.lineId === detail.lineId && item.productId === detail.productId)) entry.details.push(detail);
    found.set(locationKey, entry);
  };
  guidedRows(book).forEach(({ guidedSelection: guided, guidedRequirementKey }) => {
    const label = guided.requirementLabel || clientSelectionCategoryForRequirement(guidedRequirementKey || guided.requirementKey || "")?.label || "Selections";
    (guided.plumbingAllocation?.lines || []).forEach((line) => (line.allocations || []).forEach((allocation) => {
      if (Number(allocation.quantity) <= 0) return;
      const sourceLevelId = canonicalSelectionLocation(allocation.location).levelId || allocation.levelId || "";
      const roomEvidence = rooms.filter((room) => !sourceLevelId || room.levelId === sourceLevelId).flatMap((room) =>
        (guided.plumbingAllocation?.lines || []).flatMap((candidate) => (candidate.allocations || []).flatMap((candidateAllocation) => {
          if (candidateAllocation === allocation || Number(candidateAllocation.quantity) <= 0) return [];
          const candidateKey = allocationRoomKey(candidateAllocation);
          if (candidateAllocation.locationId !== room.id && candidateKey !== room.identityKey && candidateKey !== room.key) return [];
          return [{
            roomId: room.id,
            roomName: room.name,
            levelId: room.levelId || "",
            lineId: candidate.lineId || "",
            productId: candidate.productId || "",
            productName: candidate.productName || "Selected product",
            quantity: Number(candidateAllocation.quantity) || 0,
            sameStableProduct: Boolean(line.lineId && line.productId && candidate.lineId === line.lineId && candidate.productId === line.productId),
          }];
        })));
      const matchingQuantity = roomEvidence.filter((item) => item.sameStableProduct).reduce((total, item) => total + item.quantity, 0);
      note(allocation.roomName || allocation.location, allocationRoomKey(allocation), label, allocation.locationId, {
        requirementKey: guidedRequirementKey || guided.requirementKey || "", lineId: line.lineId || "", productId: line.productId || "", productName: line.productName || "Selected product",
        quantity: Number(allocation.quantity) || 0, unitPrice: line.unitPrice ?? null, priceIncludesGst: line.priceIncludesGst ?? null,
        roomEvidence, duplicateProven: Boolean(line.lineId && line.productId && matchingQuantity >= Number(allocation.quantity)),
      });
    }));
    (guided.tilingRooms || []).forEach((room) => note(room.name, "", "Tiles & Stone"));
    (guided.paintScheme?.overrides || []).forEach((item) => note(item.location, "", "Paint"));
    (guided.paintScheme?.featureWalls || []).forEach((item) => note(item.location, "", "Paint"));
    (guided.cabinetrySelection?.locations || []).filter((item) => item.included !== false).forEach((item) => note(item.location || item.name, "", "Cabinetry"));
  });
  const keys = [...found.keys()];
  return [...found.values()].filter((entry) => !keys.some((key) => key !== entry.key && entry.key.startsWith(`${key}-`))).map((entry) => {
    const words = roomWords(entry.name);
    const matches = rooms.filter((room) => sameWords(words, roomWords(room.name)));
    return { ...entry, suggestion: matches.length === 1 ? matches[0] : null };
  });
}

// What a merge of `from` into `to` would collide on: the same requirement has an allocation in
// both rooms. The builder says, per conflict, whether that is ONE item recorded twice ("same") or
// TWO items ("both"); a different product in each room can also keep the target's ("keep-target").
//   [{ id, requirementKey, requirementLabel, kind: "same-product" | "different-product", from: { product, quantity }, to: { product, quantity } }]
export function roomMergeConflicts(book = {}, from = {}, to = {}, { rooms = [] } = {}) {
  const fromKey = from.key, toKey = keyOf(to.name);
  if (!fromKey || !toKey) return [];
  const otherKeys = new Set(rooms.filter((room) => room.id !== from.id).map((room) => room.key));
  const conflicts = [];
  guidedRows(book).forEach(({ guidedSelection: guided, guidedRequirementKey }) => {
    const requirementKey = guidedRequirementKey || guided.requirementKey || "";
    const lines = guided.plumbingAllocation?.lines || [];
    const positions = (roomKey) => lines.flatMap((line) => (line.allocations || []).filter((allocation) => Number(allocation.quantity) > 0 && within(allocationRoomKey(allocation), roomKey, roomKey === fromKey ? otherKeys : new Set()))
      .map((allocation) => ({ line, allocation, position: allocationRoomKey(allocation).slice(roomKey.length) })));
    positions(fromKey).forEach((incoming) => positions(toKey).filter((existing) => existing.position === incoming.position).forEach((existing) => {
      const same = existing.line === incoming.line || (existing.line.productId && existing.line.productId === incoming.line.productId);
      conflicts.push({ id: `${requirementKey}|${incoming.line.lineId || incoming.line.productName}|${existing.line.lineId || existing.line.productName}|${incoming.position}`, requirementKey, requirementLabel: guided.requirementLabel || requirementKey,
        kind: same ? "same-product" : "different-product", from: { product: incoming.line.productName, quantity: Number(incoming.allocation.quantity) || 0 }, to: { product: existing.line.productName, quantity: Number(existing.allocation.quantity) || 0 } });
    }));
  });
  return conflicts;
}
