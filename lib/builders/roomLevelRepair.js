// Reconciles the levels of an existing job's rooms from preserved plan-sheet evidence.
//
//   planRoomLevelRepair(book, workbook)  -> a preview; changes nothing
//   applyRoomLevelRepair(book, plan)     -> a new book; only rooms the plan says to change are touched
//
// Rules: a level the builder chose is kept (a legacy label with an established meaning, such as
// "Second Level", is shown under its canonical name). A level is assigned only where the plan
// sheets the room was found on agree on one classified level. Anything else is left unset and listed
// with the reason; nothing is defaulted to Ground Floor.

import { projectLocations } from "./projectLocations.js";
import { projectRoomModel, setRoomLevels } from "./projectRoomModel.js";
import { levelIdOf, levelLabel } from "./buildingLevels.js";

export const ROOM_LEVEL_STATUS = Object.freeze({ KEEP: "keep", NORMALISE: "normalise", ASSIGN: "assign", REVIEW: "review" });

// The same room list Client Selections builds (selections-book.js), so the preview matches the screen.
const listedRooms = (book, workbook) => projectLocations({ book, workbook, cabinetryLocations: (book?.rooms || []).flatMap((room) => room.rows || []).find((row) => row?.guidedSelection?.cabinetrySelection)?.guidedSelection.cabinetrySelection.locations || [] });

export function planRoomLevelRepair(book = null, workbook = null) {
  const model = projectRoomModel(book, workbook);
  const savedLevel = new Map((model.rooms || []).map((entry) => [entry.id, String(entry.level || "").trim()]));
  const rooms = listedRooms(book, workbook);
  const entries = rooms.map((room) => {
    const stored = savedLevel.get(room.id) || "";
    const base = { id: room.id, name: room.name, source: room.source, sheets: room.levelSheets || [], currentLevel: stored, proposedLevel: room.level || "", proposedLevelId: room.levelId || "" };
    if (stored && room.levelId && stored === room.level) return { ...base, status: ROOM_LEVEL_STATUS.KEEP, reason: "Level already set by the builder." };
    if (stored && room.levelId) return { ...base, status: ROOM_LEVEL_STATUS.NORMALISE, reason: `"${stored}" is shown as ${room.level}.` };
    if (stored) return { ...base, status: ROOM_LEVEL_STATUS.REVIEW, reason: room.levelReview };
    if (room.levelSource === "takeoff-sheet") return { ...base, status: ROOM_LEVEL_STATUS.ASSIGN, reason: `Found on sheet${room.levelSheets.length === 1 ? "" : "s"} ${room.levelSheets.join(", ")}, classified ${room.level}.` };
    return { ...base, status: ROOM_LEVEL_STATUS.REVIEW, reason: room.levelReview || "No plan-sheet evidence for this room." };
  });
  const count = (status) => entries.filter((entry) => entry.status === status).length;
  return { rooms: entries, summary: { total: entries.length, keep: count("keep"), normalise: count("normalise"), assign: count("assign"), review: count("review") } };
}

export function applyRoomLevelRepair(book = null, plan = null, workbook = null, now = new Date().toISOString()) {
  const changes = (plan?.rooms || []).filter((entry) => [ROOM_LEVEL_STATUS.ASSIGN, ROOM_LEVEL_STATUS.NORMALISE].includes(entry.status) && entry.proposedLevelId);
  if (!changes.length) return { book, applied: 0 };
  const locations = new Map(listedRooms(book, workbook).map((room) => [room.id, room]));
  const assignments = changes.map((entry) => ({
    room: locations.get(entry.id),
    level: levelLabel(levelIdOf(entry.proposedLevel)),
    levelSource: entry.status === ROOM_LEVEL_STATUS.ASSIGN ? "takeoff-sheet" : "builder",
    levelSheets: entry.sheets,
  })).filter((item) => item.room && item.level);
  const { model } = setRoomLevels(projectRoomModel(book, workbook), assignments, now);
  return { book: { ...book, projectRoomModel: model, updatedAt: now }, applied: assignments.length };
}
