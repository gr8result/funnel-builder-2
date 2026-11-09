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


// Confirmed builder decisions are job-level facts: they must survive opening an older job file,
// restoring a browser draft or loading an older cloud copy, none of which may silently bring back a
// product, room or allocation the builder removed. (On 2026-10-30 a job file saved 56 minutes before
// the 2026-10-25 corrections was opened over the corrected job: Origin toilets, STANZA and AeroFlow
// fans and an unconfirmed room list all came back.)
//   - the corrections ledger: every confirmed instruction from every copy is kept (a union, so no
//     instruction is lost), stamped with the latest confirmation time;
//   - the room model: the most recently CONFIRMED room list wins over an unconfirmed or older one.
const correctionKey = (item = {}) => JSON.stringify([item.requirementKey || "", item.productId || "", item.productCode || "", item.levelId || "", item.from || "", item.to || ""]);
const confirmedTime = (value) => (Number.isFinite(Date.parse(value?.confirmedAt)) ? Date.parse(value.confirmedAt) : 0);

export function mergeCorrectionLedgers(ledgers = []) {
  const valid = ledgers.filter((ledger) => ledger && Number(ledger.version) === 1);
  if (!valid.length) return null;
  const newest = [...valid].sort((a, b) => confirmedTime(b) - confirmedTime(a))[0];
  const union = (field) => {
    const seen = new Map();
    valid.forEach((ledger) => (ledger[field] || []).forEach((item) => { if (!seen.has(correctionKey(item))) seen.set(correctionKey(item), item); }));
    return [...seen.values()];
  };
  return { ...newest, version: 1, removeProducts: union("removeProducts"), removeFloorAllocations: union("removeFloorAllocations"), mergeRooms: union("mergeRooms") };
}

export function carryForwardConfirmedDecisions(book = {}, sources = []) {
  if (!book || typeof book !== "object") return { book, carried: { ledger: false, roomModel: false } };
  const others = sources.filter((source) => source && typeof source === "object" && source !== book);
  // A deliberate rollback (an older job file opened exactly as it is) discarded the confirmed decisions it
  // lists; those are never carried back in. Decisions confirmed after the rollback still are.
  const rollback = book.clientSelectionRollback || null;
  const discardedLedgerAt = confirmedTime({ confirmedAt: rollback?.discardedCorrectionsConfirmedAt });
  const discardedRoomsAt = confirmedTime({ confirmedAt: rollback?.discardedRoomListConfirmedAt });
  const keepLedger = (ledger) => ledger && (!rollback || confirmedTime(ledger) > discardedLedgerAt);
  const keepModel = (model) => model && (!rollback || confirmedTime(model) > discardedRoomsAt);
  const ledger = mergeCorrectionLedgers([book.clientSelectionCorrections, ...others.map((source) => source.clientSelectionCorrections).filter(keepLedger)]);
  const ledgerChanged = Boolean(ledger) && JSON.stringify(ledger) !== JSON.stringify(book.clientSelectionCorrections || null);
  const models = [book.projectRoomModel, ...others.map((source) => source.projectRoomModel).filter(keepModel)].filter((model) => model?.confirmedAt && Array.isArray(model.rooms));
  const confirmed = models.sort((a, b) => confirmedTime(b) - confirmedTime(a))[0] || null;
  const modelChanged = Boolean(confirmed) && confirmed !== book.projectRoomModel && confirmedTime(confirmed) > confirmedTime(book.projectRoomModel);
  if (!ledgerChanged && !modelChanged) return { book, carried: { ledger: false, roomModel: false } };
  return {
    book: { ...book, ...(ledgerChanged ? { clientSelectionCorrections: ledger } : {}), ...(modelChanged ? { projectRoomModel: confirmed } : {}) },
    carried: { ledger: ledgerChanged, roomModel: modelChanged },
  };
}
