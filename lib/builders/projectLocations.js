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
export function takeoffProjectRooms(workbook = {}) {
  const job = workbook?.aiPlanTakeoffJob || workbook?.takeoffEngine?.aiPlanTakeoffJob || null;
  if (!job) return [];
  const rooms = [];
  // The room each placed window and door belongs to.
  (Array.isArray(job.placedOpenings) ? job.placedOpenings : []).forEach((opening) => rooms.push(projectRoomFromTakeoff(opening)));
  // Measured floorplan areas that are places in the house (the building footprint is not).
  (Array.isArray(job.completedFloorplans) ? job.completedFloorplans : []).forEach((area) => {
    if (FLOORPLAN_AREAS_THAT_ARE_ROOMS.has(String(area?.type || "").trim().toLowerCase())) rooms.push(projectRoomFromTakeoff({ location: area.type }));
  });
  const analysis = job?.aiAnalysis || job?.scheduleState?.aiAnalysis || null;
  // Same acceptance rule as the Takeoff Schedule's Rooms rows (scheduleEvidence.js).
  (Array.isArray(analysis?.rooms) ? analysis.rooms : [])
    .filter((item) => item?.name && item.basis !== "ASSUMED" && !(Number(item.confidence) < 0.5))
    .forEach((item) => rooms.push(projectRoomFromTakeoff({ location: item.name })));
  return rooms.filter(Boolean);
}

// Rooms the plan analysis found a fixture in (a shower in the Ensuite): evidence the house has them.
function takeoffFixtureRoomKeys(workbook = {}) {
  const job = workbook?.aiPlanTakeoffJob || workbook?.takeoffEngine?.aiPlanTakeoffJob || null;
  const analysis = job?.aiAnalysis || job?.scheduleState?.aiAnalysis || null;
  return (Array.isArray(analysis?.fixtures) ? analysis.fixtures : [])
    .filter((item) => item?.room && item.basis !== "ASSUMED" && !(Number(item.confidence) < 0.5))
    .map((item) => plumbingLocationKey(item.room));
}

// How many placed openings and measured areas the takeoff holds for each room: { [roomKey]: n }.
export function takeoffRoomCounts(workbook = {}) {
  const counts = {};
  takeoffProjectRooms(workbook || {}).forEach((room) => { const key = plumbingLocationKey(room.name); counts[key] = (counts[key] || 0) + 1; });
  return counts;
}

// [{ id, key, name, type, source, roomKey, roomType, level }] - one entry per physical location.
export function projectLocations({ book = null, cabinetryLocations = [], workbook = null, extraNames = [] } = {}) {
  const takeoffRooms = takeoffProjectRooms(workbook || {});
  const model = projectRoomModel(book, workbook);
  // What confirms a template room: another source naming it, or records already held against it.
  const confirmed = new Set([
    ...takeoffRooms.map((room) => plumbingLocationKey(room.name)),
    ...takeoffFixtureRoomKeys(workbook || {}),
    ...cabinetryLocations.map((location) => plumbingLocationKey(location?.location || location?.name)),
    ...extraNames.map(plumbingLocationKey),
    ...roomRecordKeys(book || {}),
    ...model.rooms.filter((entry) => !entry.removed).flatMap((entry) => [...(entry.sourceKeys || []), plumbingLocationKey(entry.name)]),
  ]);
  const byKey = new Map();
  const add = (name, source, id = "", roomKey = "") => {
    const label = String(name || "").trim();
    const key = plumbingLocationKey(label);
    if (!label || !key || isSelectionCategoryName(label)) return;
    // A room already listed (the Selections Book's "Bedroom 1") is the same room the takeoff
    // measured; it keeps its entry and gains the takeoff's room key.
    if (byKey.has(key)) { if (roomKey && !byKey.get(key).roomKey) byKey.get(key).roomKey = roomKey; return; }
    byKey.set(key, { id: id || `location-${key}`, key, name: label, type: plumbingLocationType(label), source, ...(roomKey ? { roomKey } : {}) });
  };
  (book?.rooms || []).filter((room) => !isSelectionCategoryRoom(room))
    .filter((room) => !TEMPLATE_ROOM_KEYS.has(plumbingLocationKey(room.name)) || confirmed.has(plumbingLocationKey(room.name)))
    .forEach((room) => add(room.name, "selections-book", room.id));
  cabinetryLocations.forEach((location) => add(location?.location || location?.name, "cabinetry", location?.id));
  takeoffRooms.forEach((room) => add(room.name, "takeoff", "", room.roomKey));
  extraNames.forEach((name) => add(name, "project"));
  return applyRoomModel(Array.from(byKey.values()), model);
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
