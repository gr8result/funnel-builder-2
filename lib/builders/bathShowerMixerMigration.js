// Bath Mixers and Shower Mixers became ONE category, "Bath & Shower Mixers" (requirementKey
// "bath-mixer"): the same wall mixer serves a bath or a shower, and each room allocation records
// which ("Bathroom Bath", "Ensuite Shower"). This migrates a saved Selections Book on load:
//
// - the Bath Mixer row keeps its identity; its allocations gain the "Bath" application;
// - former Shower Mixer ("shower-mixer") lines move into it with the "Shower" application, and the
//   Shower Mixer row is removed;
// - a product selected in both becomes ONE line whose allocations are both sets (no double count);
// - product ids, quantities, prices and per-unit allowances are carried over unchanged, and every
//   total is rebuilt by the same plumbingSelectionPatch the save path uses.
//
// Idempotent: a book with no Shower Mixer row and no un-labelled Bath Mixer allocation is returned
// unchanged (same object).
import { PLUMBING_FIXTURE_REQUIREMENTS } from "./clientSelectionWorkflow.js";
import { plumbingAllocationApplication, plumbingLinesFromSelection, UNALLOCATED_LOCATION_KEY } from "./plumbingFixtureAllocation.js";
import { plumbingSelectionPatch } from "./plumbingSelectionPatch.js";

export const BATH_SHOWER_MIXER_KEY = "bath-mixer";
export const LEGACY_SHOWER_MIXER_KEY = "shower-mixer";

const rowRequirementKey = (row = {}) => row?.guidedSelection?.requirementKey || row?.guidedRequirementKey || "";

// An allocation already says bath or shower either in its name ("Ensuite Shower") or, after the
// project-room clean-up (selectionAllocationRooms.js), as `fixture` on the room ("Ensuite" +
// fixture "Shower"). Both are labelled; only a bare room with neither is not. (Treating the cleaned
// form as unlabelled re-labelled every shower mixer as a bath on the next load.)
const hasApplication = (allocation = {}) => allocation.locationKey === UNALLOCATED_LOCATION_KEY
  || Boolean(plumbingAllocationApplication(allocation.location))
  || /^(bath|shower)$/i.test(String(allocation.fixture || "").trim());

function withApplication(lines = [], application) {
  return lines.map((line) => ({
    ...line,
    allocations: (line.allocations || []).map((allocation) => {
      if (hasApplication(allocation)) return allocation;
      // The key is rebuilt from the new name by plumbingSelectionPatch.
      const { locationKey: _staleKey, ...rest } = allocation;
      return { ...rest, location: `${allocation.location} ${application}` };
    }),
  }));
}

// Same product selected in both categories -> one line holding both sets of allocations.
function mergeLines(...groups) {
  const byId = new Map();
  for (const line of groups.flat()) {
    const existing = byId.get(line.lineId);
    byId.set(line.lineId, existing
      ? { ...existing, unitPrice: existing.unitPrice ?? line.unitPrice, allocations: [...existing.allocations, ...line.allocations] }
      : { ...line, allocations: [...line.allocations] });
  }
  return [...byId.values()];
}

function needsMigration(rows) {
  if (rows.some((row) => rowRequirementKey(row) === LEGACY_SHOWER_MIXER_KEY)) return true;
  return rows.some((row) => rowRequirementKey(row) === BATH_SHOWER_MIXER_KEY
    && plumbingLinesFromSelection(row.guidedSelection).some((line) => line.allocations.some((allocation) => !hasApplication(allocation))));
}

export function migrateBathShowerMixerRooms(rooms = []) {
  if (!Array.isArray(rooms)) return rooms;
  const rows = rooms.flatMap((room) => (Array.isArray(room?.rows) ? room.rows : []));
  if (!needsMigration(rows)) return rooms;
  const bathRow = rows.find((row) => rowRequirementKey(row) === BATH_SHOWER_MIXER_KEY && row.guidedSelection);
  const showerRows = rows.filter((row) => rowRequirementKey(row) === LEGACY_SHOWER_MIXER_KEY);
  const lines = mergeLines(
    withApplication(plumbingLinesFromSelection(bathRow?.guidedSelection || null), "Bath"),
    ...showerRows.map((row) => withApplication(plumbingLinesFromSelection(row.guidedSelection || null), "Shower")),
  );
  const requirement = PLUMBING_FIXTURE_REQUIREMENTS.find((item) => item.requirementKey === BATH_SHOWER_MIXER_KEY);
  const base = bathRow || showerRows.find((row) => row.guidedSelection) || null;
  const previous = base?.guidedSelection || null;
  const built = lines.length ? plumbingSelectionPatch(requirement, lines, previous, {
    projectId: previous?.projectId || "",
    organisationId: previous?.organisationId || "",
    now: previous?.updatedAt || new Date().toISOString(),
  }) : null;
  const mergedRow = built && base ? { ...base, ...built.patch, guidedRequirementKey: BATH_SHOWER_MIXER_KEY } : base;
  return rooms.map((room) => {
    if (!Array.isArray(room?.rows)) return room;
    const next = room.rows
      .filter((row) => rowRequirementKey(row) !== LEGACY_SHOWER_MIXER_KEY || row === base)
      .map((row) => (row === base ? mergedRow : row));
    return next.length === room.rows.length && next.every((row, index) => row === room.rows[index]) ? room : { ...room, rows: next };
  });
}
