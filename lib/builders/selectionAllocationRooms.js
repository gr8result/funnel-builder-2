// Product allocations name the room they go in. Older jobs carry aliases ("Bed 2 Ensuite",
// "2nd BEDROOM ENSUITE", "Main Bathroom Shower") where the project room is "B2 Ensuite" / "Main
// Bathroom". This rewrites an allocation's room ONLY when its identity is verified against the
// project's room model (canonicalProjectRoomName: an exact name or a recorded source key of exactly
// one room). A trailing fixture word ("Shower", "Bath") is kept on the allocation as `fixture`.
// Supported non-room locations (Staircase, Outside, ...) and anything unverified are left as they are.
// Within one product line, allocations that land on the same room are merged; the line's total is
// unchanged. Returns the book unchanged (same object) when nothing needs rewriting.
import { canonicalProjectRoomName } from "./projectRoomModel.js";
import { canonicalSelectionLocation, plumbingLocationKey } from "./plumbingFixtureAllocation.js";

const FIXTURE_SUFFIX = /\s+(shower|bath)$/i;

export function verifiedProjectRoom(name, model = { rooms: [] }) {
  const label = String(name || "").trim();
  if (!label) return null;
  const roomNames = new Set((model?.rooms || []).filter((room) => !room.removed).map((room) => room.name));
  const special = canonicalSelectionLocation(label);
  if (special.locationType || special.levelId) return null;
  const direct = canonicalProjectRoomName(label, model);
  if (roomNames.has(direct)) return direct === label ? null : { room: direct, fixture: "" };
  const fixture = label.match(FIXTURE_SUFFIX);
  if (!fixture) return null;
  const base = canonicalProjectRoomName(label.replace(FIXTURE_SUFFIX, ""), model);
  return roomNames.has(base) ? { room: base, fixture: fixture[1][0].toUpperCase() + fixture[1].slice(1).toLowerCase() } : null;
}

export function canonicaliseSelectionAllocations(book, model = { rooms: [] }) {
  const changes = [];
  let changed = false;
  const rooms = (book?.rooms || []).map((room) => {
    let roomChanged = false;
    const rows = (room.rows || []).map((row) => {
      const lines = row?.guidedSelection?.plumbingAllocation?.lines;
      if (!Array.isArray(lines)) return row;
      let rowChanged = false;
      const nextLines = lines.map((line) => {
        if (!Array.isArray(line?.allocations)) return line;
        let lineChanged = false;
        const merged = [];
        const byRoom = new Map();
        line.allocations.forEach((allocation) => {
          const verified = verifiedProjectRoom(allocation?.location, model);
          const next = verified ? { ...allocation, location: verified.room, locationKey: plumbingLocationKey(verified.room), sourceLocation: allocation.sourceLocation || allocation.location, ...(verified.fixture ? { fixture: verified.fixture } : {}) } : allocation;
          if (verified) {
            lineChanged = true;
            changes.push({ requirementKey: row.guidedRequirementKey || row.guidedSelection?.requirementKey || "", product: line.productName || "", from: allocation.location, to: verified.room, fixture: verified.fixture, quantity: Number(allocation.quantity) || 0 });
          }
          const key = `${plumbingLocationKey(next.location)}|${next.fixture || ""}`;
          const existing = byRoom.get(key);
          if (existing && verified) {
            existing.quantity = (Number(existing.quantity) || 0) + (Number(next.quantity) || 0);
            existing.sourceLocations = [...new Set([...(existing.sourceLocations || [existing.sourceLocation || existing.location]), next.sourceLocation])];
          } else {
            const copy = { ...next };
            byRoom.set(key, copy);
            merged.push(copy);
          }
        });
        if (!lineChanged) return line;
        rowChanged = true;
        return { ...line, allocations: merged };
      });
      // The same rooms are also kept as flat lists on the selection; rename them identically so every
      // reader (schedule, quote sync, procurement) sees one room name.
      const renameList = (list) => (Array.isArray(list) ? list.map((entry) => {
        const verified = verifiedProjectRoom(entry?.location, model);
        if (!verified) return entry;
        rowChanged = true;
        return { ...entry, location: verified.room, locationKey: plumbingLocationKey(verified.room), sourceLocation: entry.sourceLocation || entry.location, ...(verified.fixture ? { fixture: verified.fixture } : {}) };
      }) : list);
      const locationSchedule = renameList(row.guidedSelection.plumbingAllocation.locationSchedule);
      const locationAllocations = renameList(row.guidedSelection.locationAllocations);
      if (!rowChanged) return row;
      roomChanged = true;
      return { ...row, guidedSelection: { ...row.guidedSelection,
        ...(Array.isArray(locationAllocations) ? { locationAllocations } : {}),
        plumbingAllocation: { ...row.guidedSelection.plumbingAllocation, lines: nextLines, ...(Array.isArray(locationSchedule) ? { locationSchedule } : {}) } } };
    });
    if (!roomChanged) return room;
    changed = true;
    return { ...room, rows };
  });
  return { book: changed ? { ...book, rooms } : book, changes };
}
