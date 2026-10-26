// One vocabulary for building levels (up to three storeys) shared by AI Takeoff, Job Setup and Client Selections.
//
// AI Takeoff stores its own sheet levels as "Ground Floor" / "Second Level" / "Third Level" and the
// measurement engine keys on those strings, so they are left alone there. Everything that shows or
// stores a room's level goes through this module instead: it resolves any known label to a stable
// id and displays the one canonical name.

export const BUILDING_LEVEL_DEFS = Object.freeze([
  { id: "ground", label: "Ground Floor", takeoff: "Ground Floor" },
  { id: "upper", label: "Upper Floor", takeoff: "Second Level" },
  { id: "third", label: "Third Floor", takeoff: "Third Level" },
]);
export const BUILDING_LEVEL_LABELS = BUILDING_LEVEL_DEFS.map((level) => level.label);

// Only labels whose meaning is established. "First Floor" is deliberately absent: in plans it can
// mean the ground floor or the one above it, so it is never converted silently.
const ALIASES = {
  ground: ["ground", "ground floor", "ground level", "ground storey", "ground story", "lower", "lower floor", "lower level", "downstairs", "gf"],
  upper: ["upper", "upper floor", "upper level", "upper storey", "upper story", "upstairs", "second", "second floor", "second level", "second storey", "second story", "2nd floor", "2nd level", "level 2"],
  third: ["third", "third floor", "third level", "third storey", "third story", "3rd floor", "3rd level", "level 3"],
};
const LOOKUP = new Map(Object.entries(ALIASES).flatMap(([id, labels]) => labels.map((label) => [label, id])));
const normal = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function levelIdOf(value) {
  return LOOKUP.get(normal(value)) || "";
}
export function levelLabel(id) {
  return BUILDING_LEVEL_DEFS.find((level) => level.id === id)?.label || "";
}
// The name AI Takeoff's own sheet classification uses for a level id.
export function takeoffLevelName(id) {
  return BUILDING_LEVEL_DEFS.find((level) => level.id === id)?.takeoff || "";
}
export const canonicalLevelLabel = (value) => levelLabel(levelIdOf(value));
export function isGenericBuildingLevelLocation(value = "") {
  const label = normal(value);
  return ["upstairs", "downstairs", "ground", "ground floor", "ground level", "upper", "upper floor", "upper level", "lower", "lower floor", "lower level", "first floor", "second floor", "second level", "third floor", "third level", "level 2", "level 3"].includes(label);
}
export const levelRank = (id) => { const index = BUILDING_LEVEL_DEFS.findIndex((level) => level.id === id); return index < 0 ? BUILDING_LEVEL_DEFS.length : index; };

// The level of a takeoff sheet, from the sheet classification: { levelId, reason }.
// A sheet that was never classified gives no level and says why; it is never guessed.
export function sheetLevel(sheetLevels = {}, page) {
  const number = Number(page);
  if (!Number.isFinite(number) || number <= 0) return { levelId: "", reason: "No plan sheet is recorded for this room" };
  const raw = sheetLevels?.[number] ?? sheetLevels?.[String(number)];
  if (raw === undefined || raw === null || raw === "" || normal(raw) === "unassigned") return { levelId: "", reason: `Sheet ${number} has no level set in AI Takeoff` };
  const levelId = levelIdOf(raw);
  return levelId ? { levelId, reason: "" } : { levelId: "", reason: `Sheet ${number} is classified "${raw}", which is not a building level` };
}

// Evidence gathered for one room from the plan sheets it was found on.
export const emptyLevelEvidence = () => ({ levelIds: [], sheets: [], unclassifiedSheets: [], missingSheet: false, reasons: [] });
export function evidenceFromSheet(sheetLevels, page) {
  const { levelId, reason } = sheetLevel(sheetLevels, page);
  const number = Number(page);
  const hasSheet = Number.isFinite(number) && number > 0;
  return { levelIds: levelId ? [levelId] : [], sheets: hasSheet ? [number] : [], unclassifiedSheets: hasSheet && !levelId ? [number] : [], missingSheet: !hasSheet, reasons: reason ? [reason] : [] };
}
export function mergeLevelEvidence(left, right) {
  const a = left || emptyLevelEvidence(), b = right || emptyLevelEvidence();
  const union = (x, y) => [...new Set([...(x || []), ...(y || [])])];
  return { levelIds: union(a.levelIds, b.levelIds), sheets: union(a.sheets, b.sheets).sort((x, y) => x - y), unclassifiedSheets: union(a.unclassifiedSheets, b.unclassifiedSheets), missingSheet: Boolean(a.missingSheet || b.missingSheet), reasons: union(a.reasons, b.reasons) };
}

// [{ levelId, level, rooms }] lowest floor first, then rooms with no level, for the Room Setup screen.
export function groupRoomsByLevel(rooms = []) {
  const groups = BUILDING_LEVEL_DEFS.map((def) => ({ levelId: def.id, level: def.label, rooms: rooms.filter((room) => room.levelId === def.id) }));
  const other = rooms.filter((room) => !room.levelId);
  return [...groups, { levelId: "", level: "Floor not set", rooms: other }].filter((group) => group.rooms.length);
}

// The level a room is shown with, and why. The builder's own choice always wins; plan evidence only
// fills a level nobody has set. { level, levelId, levelSource, levelReview, levelSheets }
//   levelSource: "builder" | "takeoff-sheet" | ""   levelReview: why the builder should look, or ""
export function resolveRoomLevel({ stored = "", evidence = null } = {}) {
  const sheets = evidence?.sheets || [];
  const storedText = String(stored ?? "").trim();
  if (storedText) {
    const levelId = levelIdOf(storedText);
    if (levelId) return { level: levelLabel(levelId), levelId, levelSource: "builder", levelReview: "", levelSheets: sheets };
    return { level: storedText, levelId: "", levelSource: "builder", levelReview: `"${storedText}" is not a recognised floor. Choose Ground Floor, Upper Floor or Third Floor.`, levelSheets: sheets };
  }
  const ids = evidence?.levelIds || [];
  if (ids.length === 1) return { level: levelLabel(ids[0]), levelId: ids[0], levelSource: "takeoff-sheet", levelReview: "", levelSheets: sheets };
  if (ids.length > 1) {
    const names = [...ids].sort((x, y) => levelRank(x) - levelRank(y)).map(levelLabel).join(" and ");
    return { level: "", levelId: "", levelSource: "", levelReview: `Found on the ${names} plans (sheets ${sheets.join(", ")}). Choose the floor this room is on, or merge only if these are one room.`, levelSheets: sheets };
  }
  const reason = evidence?.unclassifiedSheets?.length ? (evidence.reasons?.[0] || `Sheet ${evidence.unclassifiedSheets[0]} has no level set in AI Takeoff`)
    : evidence?.missingSheet ? "No plan sheet is recorded for this room"
    : "This room was not found on any classified plan sheet";
  return { level: "", levelId: "", levelSource: "", levelReview: reason, levelSheets: sheets };
}
