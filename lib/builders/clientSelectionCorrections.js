import {
  mergeProjectRooms,
  projectRoomModel,
  renameRoomRecords,
} from "./projectRoomModel.js";
import { normaliseCabinetrySelection } from "./cabinetryWorkflow.js";
import {
  canonicalSelectionLocation,
  plumbingLineWithTotals,
} from "./plumbingFixtureAllocation.js";
import { plumbingSelectionPatch } from "./plumbingSelectionPatch.js";

const keyOf = (value = "") => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function mapGuidedSelections(book, callback) {
  return {
    ...book,
    rooms: (book.rooms || []).map((room) => ({
      ...room,
      rows: (room.rows || []).map((row) => row.guidedSelection ? {
        ...row,
        guidedSelection: callback(row.guidedSelection, row),
      } : row),
    })),
  };
}

function matchesProduct(line, correction) {
  if (correction.productId && line.productId === correction.productId) return true;
  if (correction.productCode && line.productCode === correction.productCode) return true;
  return false;
}

function removeConfirmedProducts(book, corrections = []) {
  if (!corrections.length) return book;
  return mapGuidedSelections(book, (guided, row) => {
    if (!guided.plumbingAllocation?.lines?.length) return guided;
    const requirementKey = row.guidedRequirementKey || guided.requirementKey || "";
    const removals = corrections.filter((item) => item.requirementKey === requirementKey);
    if (!removals.length) return guided;
    const lines = guided.plumbingAllocation.lines.filter((line) => !removals.some((item) => matchesProduct(line, item)));
    return lines.length === guided.plumbingAllocation.lines.length ? guided : {
      ...guided,
      plumbingAllocation: { ...guided.plumbingAllocation, lines },
    };
  });
}

function removeConfirmedFloorAllocations(book, corrections = []) {
  if (!corrections.length) return book;
  return mapGuidedSelections(book, (guided, row) => {
    if (!guided.plumbingAllocation?.lines?.length) return guided;
    const requirementKey = row.guidedRequirementKey || guided.requirementKey || "";
    const removals = corrections.filter((item) => item.requirementKey === requirementKey);
    if (!removals.length) return guided;
    let changed = false;
    const lines = guided.plumbingAllocation.lines.map((line) => {
      const matching = removals.filter((item) => matchesProduct(line, item));
      if (!matching.length) return line;
      const allocations = (line.allocations || []).filter((allocation) => {
        const location = canonicalSelectionLocation(allocation.legacyLocation || allocation.location || "");
        const remove = Boolean(location.levelId) && matching.some((item) => !item.levelId || item.levelId === location.levelId);
        if (remove) changed = true;
        return !remove;
      });
      return plumbingLineWithTotals({ ...line, allocations });
    }).filter((line) => Number(line.quantity) > 0);
    return changed ? { ...guided, plumbingAllocation: { ...guided.plumbingAllocation, lines } } : guided;
  });
}

function mergeConfirmedRooms(book, merges = []) {
  return merges.reduce((current, merge) => {
    const model = projectRoomModel(current);
    const rooms = model.rooms || [];
    const fromKey = keyOf(merge.from);
    const toKey = keyOf(merge.to);
    const modelSource = rooms.find((room) => room.key === fromKey || keyOf(room.name) === fromKey);
    const from = modelSource || { id: merge.fromId || `location-${fromKey}`, key: fromKey, name: merge.from };
    const to = rooms.find((room) => room.key === toKey || keyOf(room.name) === toKey) || { id: merge.toId || `location-${toKey}`, key: toKey, name: merge.to };
    const records = renameRoomRecords(current, from, to, { rooms, merge: true, resolutions: merge.resolutions || {} });
    if (!modelSource) return records;
    const merged = mergeProjectRooms(model, from, to);
    return merged.error ? records : { ...records, projectRoomModel: merged.model };
  }, book);
}

function normaliseAllocatedSelectionRows(book) {
  return {
    ...book,
    rooms: (book.rooms || []).map((room) => ({
      ...room,
      rows: (room.rows || []).map((row) => {
        const guided = row.guidedSelection;
        if (!guided?.plumbingAllocation?.lines?.length) return row;
        const requirementKey = row.guidedRequirementKey || guided.requirementKey || "";
        const requirement = {
          requirementKey,
          label: guided.requirementLabel || row.item || requirementKey,
          areaKey: guided.area || "",
          areaLabel: guided.room || room.name || "",
          familyKey: guided.familyKey || "",
          linkedQuoteItemCode: guided.linkedQuoteItemCode || "",
          unit: guided.unit || "EACH",
          defaultAllowance: guided.allowance ?? row.allowanceAmount ?? 0,
        };
        const built = plumbingSelectionPatch(requirement, guided.plumbingAllocation.lines, guided, {
          projectId: guided.projectId || "",
          organisationId: guided.organisationId || "",
          now: guided.updatedAt || guided.selectedAt || guided.selectionTimestamp || book.updatedAt || "",
        });
        if (!built) return row;
        return {
          ...row,
          ...built.patch,
          guidedSelection: {
            ...guided,
            ...built.patch.guidedSelection,
          },
        };
      }),
    })),
  };
}

function normaliseCabinetryRecords(book) {
  const model = projectRoomModel(book);
  return {
    ...book,
    rooms: (book.rooms || []).map((room) => ({
      ...room,
      rows: (room.rows || []).map((row) => {
        const selection = row.guidedSelection?.cabinetrySelection;
        if (!selection) return row;
        return {
          ...row,
          guidedSelection: {
            ...row.guidedSelection,
            cabinetrySelection: normaliseCabinetrySelection(selection, model),
          },
        };
      }),
    })),
  };
}

export function applyConfirmedClientSelectionCorrections(book = {}) {
  const corrections = book.clientSelectionCorrections;
  if (!corrections || Number(corrections.version) !== 1) return book;
  let corrected = removeConfirmedProducts(book, corrections.removeProducts || []);
  corrected = removeConfirmedFloorAllocations(corrected, corrections.removeFloorAllocations || []);
  corrected = mergeConfirmedRooms(corrected, corrections.mergeRooms || []);
  corrected = normaliseCabinetryRecords(corrected);
  return normaliseAllocatedSelectionRows(corrected);
}
