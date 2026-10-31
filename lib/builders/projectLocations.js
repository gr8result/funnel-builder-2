// The ONE source of physical project locations (rooms) for Client Selections.
//
// A Selections Book stores each selection category's rows in a container "room" named after the
// category ("Bathroom Accessories", "Plumbing Fixtures", "Shower Screens & Mirrors", ...). Those
// containers are bookkeeping, not places in the house, and must never be offered as a location -
// "Bathroom Accessories" used to leak into room lists because its name contains "bath".
//
// Every location list (plumbing allocation, tiling rooms, accessory packs, shower screens, ...) is
// built from projectLocations(), which reads only real rooms:
//   - the Selections Book's own rooms (builder-added rooms included), minus category containers;
//   - the project's Cabinetry locations;
//   - rooms recorded by AI Plan Takeoff: the room each window and door was placed in, the
//     measured floorplan areas (Garage, Alfresco, ...) and the rooms named by plan analysis.
// Each location keeps a stable id (the book room id where there is one) as well as its name, and
// a takeoff room keeps the takeoff's canonical room key (bed-4, media-theatre, ...).
//
// The Selections Book is created from a fixed document template (Bedroom 1-3, Living, Main
// Bathroom, ...). Those template rooms are pages of a document, not evidence about this house: one
// is a project room only when the takeoff, the cabinetry locations, a module's own records or the
// user (Manage Rooms) says the house has it. Nothing is listed just because it is a common room.
//
// The user's corrections - add, rename, remove, merge (projectRoomModel.js) - are applied last, so
// every module sees the same corrected house.
//
// A module FILTERS this list for what is relevant to it (paintable rooms, wet areas, ...). No
// module keeps its own list of the rooms a house has.

import { ALL_GUIDED_REQUIREMENTS, LEGACY_ROOM_REQUIREMENTS } from "./clientSelectionWorkflow.js";
import { CLIENT_SELECTION_CATEGORIES, CLIENT_SELECTION_CATEGORY_GROUPS, CLIENT_SELECTION_SIDES } from "./clientSelectionCategories.js";
import { plumbingLocationKey, plumbingLocationType } from "./plumbingFixtureAllocation.js";
import { ROOM_LOCATION_CUSTOM_KEY, resolveOpeningRoom } from "../../components/construction-estimation/ai-plan-takeoff/takeoffRunData.js";
import { applyRoomModel, projectRoomModel, roomRecordKeys } from "./projectRoomModel.js";
import { evidenceFromSheet as sheetEvidenceFromSheet, levelIdOf, levelLabel, mergeLevelEvidence, isGenericBuildingLevelLocation } from "./buildingLevels.js";

// The rooms every new Selections Book document is laid out with (selections-book.js builds its
// pages from this). A document template only: see the note above.
export const SELECTIONS_BOOK_TEMPLATE_ROOMS = [
  "External Walls", "Roof", "Windows", "Garage", "Kitchen", "Laundry", "Main Bathroom", "Ensuite", "Powder Room",
  "Bedroom 1", "Bedroom 2", "Bedroom 3", "Living", "Electrical", "Lighting", "Flooring", "Paint", "External",
];
const TEMPLATE_ROOM_KEYS = new Set(SELECTIONS_BOOK_TEMPLATE_ROOMS.map(plumbingLocationKey));

// Area labels that are also genuine rooms (the Kitchen area's rows live in the Kitchen room).
const PHYSICAL_AREA_LABELS = new Set(LEGACY_ROOM_REQUIREMENTS.map((item) => plumbingLocationKey(item.label)));

const CATEGORY_CONTAINER_KEYS = new Set([
  ...ALL_GUIDED_REQUIREMENTS.flatMap((item) => [item.areaLabel, item.areaKey]),
  ...CLIENT_SELECTION_CATEGORIES.flatMap((item) => [item.label, item.key]),
  ...CLIENT_SELECTION_CATEGORY_GROUPS.map((item) => item.label),
  ...CLIENT_SELECTION_SIDES.map((item) => item.label),
  "Selections", "Client Selections",
].map(plumbingLocationKey).filter((key) => key && !PHYSICAL_AREA_LABELS.has(key)));

// True for a selection category / area name, which is never a physical location.
export function isSelectionCategoryName(name = "") {
  return CATEGORY_CONTAINER_KEYS.has(plumbingLocationKey(name));
}

export function isSelectionCategoryRoom(room = {}) {
  if (isSelectionCategoryName(room?.name)) return true;
  // A guided container that holds only guided-requirement rows and is not a real room name.
  return String(room?.id || "").startsWith("guided-") && !PHYSICAL_AREA_LABELS.has(plumbingLocationKey(room?.name)) && !plumbingLocationType(room?.name);
}

// How a takeoff room is shown to a client. The takeoff's own labels are drafting shorthand
// ("Bed 4", "Media / Theatre", "WIR / Walk-in Robe"); the room and its key are unchanged.
const ROOM_DISPLAY_NAMES = { "media-theatre": "Media Room", entry: "Entry", wir: "Walk-in Robe", hallway: "Hallway" };
// Plan text the takeoff's own alias table does not cover. Only unambiguous shorthand.
const PLAN_ROOM_ALIASES = { media: "Media / Theatre", butlers: "Butler's Pantry", butlerspantry: "Butler's Pantry", "butlers pantry": "Butler's Pantry" };
const NOT_A_ROOM_KEYS = new Set(["exterior"]);

// { roomKey, name } for a room as the takeoff recorded it (a room key, a label, or plan text such
// as "BED 4" / "MEDIA"). A room the takeoff does not recognise keeps its own name: different
// rooms are never merged by guessing.
export function projectRoomFromTakeoff(room = {}) {
  const text = String(room.location || room.room || room.roomLabel || room.name || "").trim();
  const alias = PLAN_ROOM_ALIASES[text.toLowerCase().replace(/['’]/g, "").replace(/\s+/g, " ")];
  const resolved = resolveOpeningRoom(room.roomKey ? room : { location: alias || text });
  if (!resolved.roomKey || NOT_A_ROOM_KEYS.has(resolved.roomKey)) return null;
  if (resolved.custom) {
    const label = String(resolved.roomLabel || "").trim();
    // Plan lettering is often capitals; a custom room keeps its wording in readable case.
    // Short words are abbreviations (WC, WIR) and stay as lettered.
    const name = label && label === label.toUpperCase() ? label.replace(/[A-Z]{4,}/g, (word) => word[0] + word.slice(1).toLowerCase()) : label;
    return name ? { roomKey: ROOM_LOCATION_CUSTOM_KEY, name } : null;
  }
  const bedroom = resolved.roomKey.match(/^bed-(\d+)$/);
  return { roomKey: resolved.roomKey, name: bedroom ? `Bedroom ${bedroom[1]}` : ROOM_DISPLAY_NAMES[resolved.roomKey] || resolved.roomLabel };
}

const FLOORPLAN_AREAS_THAT_ARE_ROOMS = new Set(["garage", "alfresco", "patio", "balcony", "porch", "deck", "workshop"]);

// Every room the job's takeoff records, in the order the takeoff met them.
// Each room carries `levelEvidence`: the plan sheets it was found on and the level AI Takeoff
// classified each sheet as. The level comes from the sheet, never from the room's name.
export function takeoffProjectRooms(workbook = {}) {
  const job = workbook?.aiPlanTakeoffJob || workbook?.takeoffEngine?.aiPlanTakeoffJob || null;
  if (!job) return [];
  const sheetLevels = job.sheetLevels || {};
  const rooms = [];
  const push = (room, page, analysisLevel = "") => {
    if (!room) return;
    let levelEvidence = sheetEvidenceFromSheet(sheetLevels, page);
    // A room the plan analysis placed on a level already carries the sheet's level.
    const analysed = levelIdOf(analysisLevel);
    if (analysed && !levelEvidence.levelIds.length) levelEvidence = { ...levelEvidence, levelIds: [analysed], unclassifiedSheets: [], reasons: [] };
    rooms.push({ ...room, ...(Number(page) > 0 ? { page: Number(page) } : {}), levelEvidence });
  };
  // The room each placed window and door belongs to.
  (Array.isArray(job.placedOpenings) ? job.placedOpenings : []).forEach((opening) => push(projectRoomFromTakeoff(opening), opening?.page));
  // Measured floorplan areas that are places in the house (the building footprint is not).
  (Array.isArray(job.completedFloorplans) ? job.completedFloorplans : []).forEach((area) => {
    if (FLOORPLAN_AREAS_THAT_ARE_ROOMS.has(String(area?.type || "").trim().toLowerCase())) push(projectRoomFromTakeoff({ location: area.type }), area?.page);
  });
  const analysis = job?.aiAnalysis || job?.scheduleState?.aiAnalysis || null;
  // Same acceptance rule as the Takeoff Schedule's Rooms rows (scheduleEvidence.js).
  (Array.isArray(analysis?.rooms) ? analysis.rooms : [])
    .filter((item) => item?.name && item.basis !== "ASSUMED" && !(Number(item.confidence) < 0.5))
    .forEach((item) => push(projectRoomFromTakeoff({ location: item.name }), item.page, item.levelId || item.level));
  return rooms.filter(Boolean);
}

function takeoffFixtureRooms(workbook = {}) {
  const job = workbook?.aiPlanTakeoffJob || workbook?.takeoffEngine?.aiPlanTakeoffJob || null;
  const analysis = job?.aiAnalysis || job?.scheduleState?.aiAnalysis || null;
  const rooms = [];
  (Array.isArray(analysis?.fixtures) ? analysis.fixtures : [])
    .filter((item) => item?.room && item.basis !== "ASSUMED" && !(Number(item.confidence) < 0.5))
    .forEach((item) => {
      const room = projectRoomFromTakeoff({ location: item.room });
      if (!room) return;
      const evidence = sheetEvidenceFromSheet(job.sheetLevels || {}, item.page);
      const levelId = levelIdOf(item.levelId || item.level);
      const levelEvidence = levelId && !evidence.levelIds.length ? { ...evidence, levelIds: [levelId], unclassifiedSheets: [], reasons: [] } : evidence;
      rooms.push({ ...room, ...(Number(item.page) > 0 ? { page: Number(item.page) } : {}), levelEvidence });
    });
  return rooms;
}

// Rooms the plan analysis found a fixture in (a shower in the Ensuite): evidence the house has them.
function takeoffFixtureRoomKeys(workbook = {}) {
  const job = workbook?.aiPlanTakeoffJob || workbook?.takeoffEngine?.aiPlanTakeoffJob || null;
  const analysis = job?.aiAnalysis || job?.scheduleState?.aiAnalysis || null;
  return (Array.isArray(analysis?.fixtures) ? analysis.fixtures : [])
    .filter((item) => item?.room && item.basis !== "ASSUMED" && !(Number(item.confidence) < 0.5))
    .map((item) => plumbingLocationKey(item.room));
}

export function takeoffRoomEvidence(workbook = {}) {
  const job = workbook?.aiPlanTakeoffJob || workbook?.takeoffEngine?.aiPlanTakeoffJob || null;
  if (!job) return {};
  const evidence = {};
  const add = (room, record) => {
    if (!room) return;
    const key = plumbingLocationKey(room.name);
    const keys = [key];
    if (record.levelId) keys.push(`${key}@${record.levelId}`);
    keys.forEach((roomKey) => { evidence[roomKey] = [...(evidence[roomKey] || []), record]; });
  };
  (job.placedOpenings || []).forEach((opening, index) => {
    const room = projectRoomFromTakeoff(opening);
    if (!room) return;
    const levelEvidence = sheetEvidenceFromSheet(job.sheetLevels || {}, opening?.page);
    const levelId = levelEvidence.levelIds.length === 1 ? levelEvidence.levelIds[0] : levelIdOf(opening?.levelId || opening?.level || opening?.floor);
    const rawType = String(opening?.openingType || opening?.type || opening?.category || opening?.kind || "").trim();
    const classification = /window/i.test(rawType) ? "Window" : /door|slider|cavity/i.test(rawType) ? "Door" : "Opening";
    const hasGeometry = Boolean(opening?.geometry || opening?.bounds || opening?.bbox || opening?.polygon || opening?.points
      || [opening?.x, opening?.y, opening?.width, opening?.height].some((value) => Number.isFinite(Number(value))));
    add(room, {
      recordId: String(opening?.id || opening?.openingId || opening?.itemId || opening?.sourceId || "(not recorded)"),
      recordType: "placed-opening",
      classification,
      assignedRoomId: String(opening?.roomId || opening?.roomKey || room.roomKey || ""),
      assignedRoomName: room.name,
      levelId: levelId || "",
      floor: levelId ? levelLabel(levelId) : String(opening?.floor || ""),
      page: Number(opening?.page) || null,
      sourceReference: `placedOpenings[${index}]`,
      sourceEvidence: hasGeometry ? "placed-opening geometry" : "saved placed-opening room reference",
    });
  });
  (job.completedFloorplans || []).forEach((area, index) => {
    if (!FLOORPLAN_AREAS_THAT_ARE_ROOMS.has(String(area?.type || "").trim().toLowerCase())) return;
    const room = projectRoomFromTakeoff({ location: area.type });
    const levelEvidence = sheetEvidenceFromSheet(job.sheetLevels || {}, area?.page);
    const levelId = levelEvidence.levelIds.length === 1 ? levelEvidence.levelIds[0] : levelIdOf(area?.levelId || area?.level || area?.floor);
    add(room, {
      recordId: String(area?.id || area?.areaId || area?.itemId || "(not recorded)"),
      recordType: "measured-area",
      classification: "Measured area",
      assignedRoomId: String(area?.roomId || room?.roomKey || ""),
      assignedRoomName: room?.name || String(area?.type || ""),
      levelId: levelId || "",
      floor: levelId ? levelLabel(levelId) : String(area?.floor || ""),
      page: Number(area?.page) || null,
      sourceReference: `completedFloorplans[${index}]`,
      sourceEvidence: area?.geometry || area?.points || area?.polygon ? "measured-area geometry" : "saved measured-area record",
    });
  });
  const analysis = job?.aiAnalysis || job?.scheduleState?.aiAnalysis || null;
  (analysis?.rooms || []).forEach((item, index) => {
    if (!item?.name || item.basis === "ASSUMED" || Number(item.confidence) < 0.5) return;
    const room = projectRoomFromTakeoff({ location: item.name });
    const levelEvidence = sheetEvidenceFromSheet(job.sheetLevels || {}, item?.page);
    const levelId = levelEvidence.levelIds.length === 1 ? levelEvidence.levelIds[0] : levelIdOf(item?.levelId || item?.level);
    add(room, {
      recordId: String(item?.id || item?.roomId || item?.sourceId || "(not recorded)"),
      recordType: "room-analysis",
      classification: "AI room evidence",
      assignedRoomId: String(item?.roomId || room?.roomKey || ""),
      assignedRoomName: room?.name || String(item?.name || ""),
      levelId: levelId || "",
      floor: levelId ? levelLabel(levelId) : "",
      page: Number(item?.page) || null,
      sourceReference: `aiAnalysis.rooms[${index}]`,
      sourceEvidence: `${item.basis || "detected"}${Number.isFinite(Number(item.confidence)) ? `, confidence ${Number(item.confidence)}` : ""}`,
    });
  });
  return evidence;
}

export function takeoffRoomCounts(workbook = {}) {
  return Object.fromEntries(Object.entries(takeoffRoomEvidence(workbook)).map(([key, records]) => [key, records.length]));
}

// [{ id, key, name, type, source, roomKey, roomType, level }] - one entry per physical location.
export function projectLocations({ book = null, cabinetryLocations = [], workbook = null, extraNames = [] } = {}) {
  const takeoffRooms = takeoffProjectRooms(workbook || {});
  const fixtureRooms = takeoffFixtureRooms(workbook || {});
  const model = projectRoomModel(book, workbook);
  const takeoffLevelsByName = new Map();
  takeoffRooms.forEach((room) => {
    const levels = takeoffLevelsByName.get(plumbingLocationKey(room.name)) || new Set();
    (room.levelEvidence?.levelIds || []).forEach((levelId) => levels.add(levelId));
    takeoffLevelsByName.set(plumbingLocationKey(room.name), levels);
  });
  // What confirms a template room: another source naming it, or records already held against it.
  const confirmed = new Set([
    ...takeoffRooms.map((room) => plumbingLocationKey(room.name)),
    ...fixtureRooms.map((room) => plumbingLocationKey(room.name)),
    ...takeoffFixtureRoomKeys(workbook || {}),
    ...cabinetryLocations.map((location) => plumbingLocationKey(location?.location || location?.name)),
    ...extraNames.map(plumbingLocationKey),
    ...roomRecordKeys(book || {}),
    ...model.rooms.filter((entry) => !entry.removed).flatMap((entry) => [...(entry.sourceKeys || []), plumbingLocationKey(entry.name)]),
  ]);
  const byKey = new Map();
  const add = (name, source, id = "", roomKey = "", levelEvidence = null, preserveAmbiguous = false) => {
    const label = String(name || "").trim();
    const nameKey = plumbingLocationKey(label);
    if (!label || !nameKey || isSelectionCategoryName(label) || isGenericBuildingLevelLocation(label)) return;
    const levelIds = levelEvidence?.levelIds || [];
    const savedRoom = id ? model.rooms.find((entry) => entry.id === id && !entry.removed) : null;
    const savedLevelId = levelIdOf(savedRoom?.level);
    const levelId = savedLevelId || (levelIds.length === 1 ? levelIds[0] : "");
    const ambiguousUnlevelledBookRoom = source === "selections-book" && !levelId && (savedRoom || preserveAmbiguous) && (takeoffLevelsByName.get(nameKey)?.size || 0) > 1;
    if (ambiguousUnlevelledBookRoom) {
      const identityKey = `${nameKey}@unassigned:${id || "book"}`;
      byKey.set(identityKey, { id: id || `location-${identityKey}`, key: nameKey, identityKey, nameKey, name: label, type: plumbingLocationType(label), source, levelEvidence: null, ambiguousLevelIdentity: true });
      return;
    }
    let identityKey = levelId ? `${nameKey}@${levelId}` : nameKey;
    // A legacy book page without a floor is adopted by the first unambiguous takeoff match.
    // Further same-named rooms on other floors remain separate locations.
    if (levelId && byKey.has(nameKey) && !byKey.get(nameKey).levelEvidence?.levelIds?.length) {
      const listed = byKey.get(nameKey);
      byKey.delete(nameKey);
      listed.identityKey = identityKey;
      listed.levelEvidence = levelEvidence;
      if (roomKey && !listed.roomKey) listed.roomKey = roomKey;
      byKey.set(identityKey, listed);
      return;
    }
    if (!levelId) {
      const sameName = [...byKey.values()].filter((location) => location.nameKey === nameKey);
      if (sameName.length === 1) {
        const listed = sameName[0];
        if (roomKey && !listed.roomKey) listed.roomKey = roomKey;
        if (levelEvidence) listed.levelEvidence = mergeLevelEvidence(listed.levelEvidence, levelEvidence);
        return;
      }
      if (sameName.length > 1) return;
    }
    identityKey = levelId ? `${nameKey}@${levelId}` : nameKey;
    if (byKey.has(identityKey)) {
      const listed = byKey.get(identityKey);
      if (roomKey && !listed.roomKey) listed.roomKey = roomKey;
      if (levelEvidence) listed.levelEvidence = mergeLevelEvidence(listed.levelEvidence, levelEvidence);
      return;
    }
    byKey.set(identityKey, { id: id || `location-${identityKey}`, key: nameKey, identityKey, nameKey, name: label, type: plumbingLocationType(label), source, ...(roomKey ? { roomKey } : {}), ...(levelEvidence ? { levelEvidence } : {}) });
  };
  (book?.rooms || []).filter((room) => !isSelectionCategoryRoom(room))
    .filter((room) => !TEMPLATE_ROOM_KEYS.has(plumbingLocationKey(room.name)) || confirmed.has(plumbingLocationKey(room.name)))
    .forEach((room) => add(room.name, "selections-book", room.id, "", null, (room.rows || []).some((row) => row?.selectedProduct || row?.guidedSelection || row?.selectedOptionId)));
  cabinetryLocations.forEach((location) => add(location?.location || location?.name, "cabinetry", location?.id));
  takeoffRooms.forEach((room) => add(room.name, "takeoff", "", room.roomKey, room.levelEvidence));
  fixtureRooms.forEach((room) => add(room.name, "takeoff-fixture", "", room.roomKey, room.levelEvidence));
  extraNames.forEach((name) => add(name, "project"));
  return applyRoomModel(Array.from(byKey.values()), model).map((location) => ({
    ...location,
    identityKey: location.levelId ? `${location.key}@${location.levelId}` : location.identityKey || location.key,
    displayName: location.level ? `${location.name} · ${levelLabel(location.levelId)}` : location.name,
  }));
}

// The legacy Selections Book keeps trade and building-element containers ("External Walls", "Roof",
// "Lighting", "Paint", ...) beside its rooms. They are not places a point, light or fan can be put.
const NOT_A_HOUSE_ROOM = /^(external|exterior|external walls?|roof|roofing|windows?|doors?|facade|bricks?|cladding|driveway|landscaping|fencing|electrical|lighting|plumbing|paint|painting|flooring|tiles?|tiling|cabinetry|appliances?|general|site|whole house|selections?)$/i;

// The project's rooms and outdoor living areas, for modules that work room by room (Electrical,
// Lighting & Ceiling Fans). A filter of the shared list: it never adds a room.
export function houseRoomNames(names = []) {
  return names.filter((name) => !NOT_A_HOUSE_ROOM.test(String(name || "").trim()));
}
export function houseRooms(locations = []) {
  return locations.filter((location) => !NOT_A_HOUSE_ROOM.test(String(location?.name || "").trim()));
}

export function projectLocationNames(options = {}) {
  return projectLocations(options).map((location) => location.name);
}
