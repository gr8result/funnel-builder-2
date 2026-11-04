// Assignments: one product in one room (or fixture position), with a quantity.
//
// A selection is stored as product lines, each with allocations ({ locationKey, location,
// quantity }) - plumbingFixtureAllocation.js. Everything here works on that one collection, so the
// Client Selections screens, the schedule, the quotation and procurement all count the same
// assignments. Nothing here adds a second record for something that already exists:
//   editing    changes the assignment that is there;
//   replacing  swaps the product in a room and keeps the number of fixtures;
//   adding     another fixture in a room happens only when the builder says so (it is marked
//              `additional`), never as a side effect of choosing a product twice.
// Each function returns new lines; the input is never changed.

import { plumbingLineWithTotals, plumbingLocationKey } from "./plumbingFixtureAllocation.js";

const text = (value) => String(value ?? "").trim();
const amount = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const keyOf = (allocation) => allocation.locationKey || plumbingLocationKey(allocation.location);
// Totals are recalculated by the allocation model; a deliberate "additional fixture" mark is kept.
const withAllocations = (line, allocations) => {
  const kept = allocations.filter((allocation) => amount(allocation.quantity) > 0);
  const additional = new Set(kept.filter((allocation) => allocation.additional === true).map(keyOf));
  const next = plumbingLineWithTotals({ ...line, allocations: kept });
  return additional.size ? { ...next, allocations: next.allocations.map((allocation) => (additional.has(keyOf(allocation)) ? { ...allocation, additional: true } : allocation)) } : next;
};
const stamp = (line, action, detail, now) => ({ ...line, history: [...(line.history || []).slice(-19), { action, ...detail, at: now }] });

// One row per assignment, for an editable table:
//   [{ lineId, productName, finish, locationKey, location, quantity, unitPrice, variationEach, additional }]
export function assignmentRows(lines = []) {
  return lines.flatMap((line) => (line.allocations || []).filter((allocation) => amount(allocation.quantity) > 0).map((allocation) => ({
    lineId: line.lineId, productName: text(line.productName), finish: text(line.finish || line.colour), locationKey: keyOf(allocation), location: text(allocation.location), quantity: amount(allocation.quantity),
    unitPrice: line.unitPrice ?? null, variationEach: line.unitPrice == null ? null : Math.round((amount(line.unitPrice) - amount(line.unitAllowance)) * 100) / 100, additional: allocation.additional === true, standard: line.isBuilderStandard === true })));
}

// What is already assigned in a room: [{ lineId, productName, quantity }].
export function assignmentsAt(lines = [], location = "", { exceptLineId = "" } = {}) {
  const key = plumbingLocationKey(location) || text(location);
  return lines.filter((line) => line.lineId !== exceptLineId).flatMap((line) => (line.allocations || []).filter((allocation) => keyOf(allocation) === key && amount(allocation.quantity) > 0)
    .map((allocation) => ({ lineId: line.lineId, productName: text(line.productName), quantity: amount(allocation.quantity) })));
}

// Change one assignment's quantity and / or room. Moving it onto a room that already has this
// product adds to that assignment; a quantity of 0 removes it. A line left with no rooms is removed.
export function updateAssignment(lines = [], lineId = "", locationKey = "", { quantity, location } = {}, now = new Date().toISOString()) {
  return lines.flatMap((line) => {
    if (line.lineId !== lineId) return [line];
    const current = (line.allocations || []).find((allocation) => keyOf(allocation) === locationKey);
    if (!current) return [line];
    const nextQuantity = quantity === undefined ? amount(current.quantity) : Math.max(0, amount(quantity));
    const nextLabel = location === undefined ? current.location : text(location);
    const nextKey = location === undefined ? locationKey : plumbingLocationKey(nextLabel);
    const others = (line.allocations || []).filter((allocation) => allocation !== current);
    const target = nextKey !== locationKey ? others.find((allocation) => keyOf(allocation) === nextKey) : null;
    const allocations = target
      ? others.map((allocation) => (allocation === target ? { ...allocation, quantity: amount(allocation.quantity) + nextQuantity } : allocation))
      : (line.allocations || []).map((allocation) => (allocation === current ? { ...allocation, locationKey: nextKey, location: nextLabel, quantity: nextQuantity } : allocation));
    const next = withAllocations(stamp(line, "edit", { from: `${current.location} ×${current.quantity}`, to: `${nextLabel} ×${nextQuantity}` }, now), allocations);
    return next.allocations.length ? [next] : [];
  });
}

export const removeAssignment = (lines, lineId, locationKey, now) => updateAssignment(lines, lineId, locationKey, { quantity: 0 }, now);

// REPLACE EXISTING: the product in a room changes; the number of fixtures there does not.
// `existingLineId` gives up its assignment in the room and `newLine` (a product line, with or
// without allocations yet) takes it over with the same quantity.
export function replaceAssignment(lines = [], { location = "", existingLineId = "" } = {}, newLine = {}, now = new Date().toISOString()) {
  const key = plumbingLocationKey(location);
  const existing = lines.find((line) => line.lineId === existingLineId);
  const held = existing?.allocations?.find((allocation) => keyOf(allocation) === key && amount(allocation.quantity) > 0);
  if (!existing || !held || !newLine?.lineId) return lines;
  if (existing.lineId === newLine.lineId) return lines;
  const allocation = { locationKey: key, location: held.location, quantity: amount(held.quantity) };
  const without = lines.flatMap((line) => {
    if (line.lineId !== existingLineId) return [line];
    const next = withAllocations(stamp(line, "replaced", { location: held.location, by: text(newLine.productName) }, now), (line.allocations || []).filter((item) => item !== held));
    return next.allocations.length ? [next] : [];
  });
  const target = without.find((line) => line.lineId === newLine.lineId);
  const merged = (base) => withAllocations(stamp(base, "replace", { location: held.location, replaced: text(existing.productName) }, now), [...(base.allocations || []).filter((item) => keyOf(item) !== key), allocation]);
  return target ? without.map((line) => (line === target ? merged(line) : line)) : [...without, merged({ ...newLine, allocations: newLine.allocations || [] })];
}

// ADD ANOTHER: a further fixture in a room that already has one, because the builder said so.
export function addAssignment(lines = [], newLine = {}, location = "", quantity = 1, { additional = false } = {}, now = new Date().toISOString()) {
  const key = plumbingLocationKey(location);
  if (!newLine?.lineId || !key || !(amount(quantity) > 0)) return lines;
  const put = (base) => {
    const there = (base.allocations || []).find((allocation) => keyOf(allocation) === key);
    const allocations = there ? (base.allocations || []).map((allocation) => (allocation === there ? { ...allocation, quantity: amount(allocation.quantity) + amount(quantity), ...(additional ? { additional: true } : {}) } : allocation))
      : [...(base.allocations || []), { locationKey: key, location: text(location), quantity: amount(quantity), ...(additional ? { additional: true } : {}) }];
    return withAllocations(stamp(base, additional ? "add-another" : "add", { location: text(location), quantity: amount(quantity) }, now), allocations);
  };
  const target = lines.find((line) => line.lineId === newLine.lineId);
  return target ? lines.map((line) => (line === target ? put(line) : line)) : [...lines, put({ ...newLine, allocations: newLine.allocations || [] })];
}

// APPLY TO OTHER ROOMS - a preview first, then the same thing applied.
//   rooms: [{ name }] the compatible rooms chosen; quantityEach: how many per room.
// preview: [{ room, state: "add" | "already" | "occupied", existing: [{ productName, quantity }] }]
//   add      - the room has nothing for this selection: the product is added.
//   already  - the room already has this product: nothing changes.
//   occupied - the room has a different product: it is replaced only when `replaceOccupied` is set.
export function applyToRoomsPreview(lines = [], lineId = "", rooms = []) {
  return rooms.map((room) => {
    const name = text(room?.name || room);
    const mine = assignmentsAt(lines, name).some((entry) => entry.lineId === lineId);
    const existing = assignmentsAt(lines, name, { exceptLineId: lineId });
    return { room: name, state: mine ? "already" : existing.length ? "occupied" : "add", existing };
  });
}
export function applyAssignmentToRooms(lines = [], lineId = "", rooms = [], { quantityEach = 1, replaceOccupied = false } = {}, now = new Date().toISOString()) {
  let next = lines;
  const applied = [], skipped = [];
  for (const entry of applyToRoomsPreview(lines, lineId, rooms)) {
    const source = next.find((line) => line.lineId === lineId);
    if (!source) break;
    if (entry.state === "already") continue;
    if (entry.state === "occupied") {
      if (!replaceOccupied) { skipped.push(entry.room); continue; }
      // Every other product in the room gives way; the count of fixtures is the first one's.
      const [first, ...rest] = assignmentsAt(next, entry.room, { exceptLineId: lineId });
      rest.forEach((other) => { next = removeAssignment(next, other.lineId, plumbingLocationKey(entry.room), now); });
      next = replaceAssignment(next, { location: entry.room, existingLineId: first.lineId }, next.find((line) => line.lineId === lineId) || source, now);
    } else next = addAssignment(next, source, entry.room, quantityEach, {}, now);
    applied.push(entry.room);
  }
  return { lines: next, applied, skipped };
}

// REPLACE the product of a whole line: every room it is in keeps its quantity under the new product.
export function replaceLineProduct(lines = [], lineId = "", newLine = {}, now = new Date().toISOString()) {
  const existing = lines.find((line) => line.lineId === lineId);
  if (!existing || !newLine?.lineId || existing.lineId === newLine.lineId) return lines;
  return (existing.allocations || []).filter((allocation) => amount(allocation.quantity) > 0).reduce((next, allocation) => replaceAssignment(next, { location: allocation.location, existingLineId: lineId }, next.find((line) => line.lineId === newLine.lineId) || newLine, now), lines);
}

// Total quantity of a selection - the one number the schedule, quotation and procurement agree on.
export const assignedQuantity = (lines = []) => Math.round(assignmentRows(lines).reduce((total, row) => total + row.quantity, 0) * 1000) / 1000;

// Choosing a product for a room that already has a different one. Nothing is decided here: the
// rooms are listed so the builder can answer REPLACE EXISTING, ADD ANOTHER or CANCEL.
//   draftLine: the line about to be saved; previousLine: that same line as it is saved now (or null).
//   -> [{ locationKey, location, quantity, existing: [{ lineId, productName, quantity }] }]
// Only rooms the draft newly takes are listed; a room it already shared is not asked about again.
export function roomConflicts(lines = [], draftLine = {}, previousLine = null) {
  const had = new Set((previousLine?.allocations || []).filter((allocation) => amount(allocation.quantity) > 0).map(keyOf));
  return (draftLine.allocations || []).filter((allocation) => amount(allocation.quantity) > 0 && keyOf(allocation) !== "unallocated" && !had.has(keyOf(allocation)))
    .map((allocation) => ({ locationKey: keyOf(allocation), location: text(allocation.location), quantity: amount(allocation.quantity),
      existing: assignmentsAt(lines, allocation.location, { exceptLineId: draftLine.lineId }).filter((entry) => entry.lineId !== previousLine?.lineId) }))
    .filter((conflict) => conflict.existing.length);
}

// Save a line with the builder's answer for the rooms in `conflicts`:
//   "replace" - the other products give up those rooms; the room holds only the new product.
//   "add"     - the other products stay and the new assignment is marked as a deliberate addition.
export function saveLineWithDecision(lines = [], draftLine = {}, conflicts = [], decision = "add", now = new Date().toISOString()) {
  const rooms = new Set(conflicts.map((conflict) => conflict.locationKey));
  let next = lines;
  if (decision === "replace") conflicts.forEach((conflict) => conflict.existing.forEach((entry) => {
    const line = next.find((item) => item.lineId === entry.lineId);
    if (!line) return;
    const kept = withAllocations(stamp(line, "replaced", { location: conflict.location, by: text(draftLine.productName) }, now), (line.allocations || []).filter((allocation) => keyOf(allocation) !== conflict.locationKey));
    next = next.flatMap((item) => (item === line ? (kept.allocations.length ? [kept] : []) : [item]));
  }));
  const allocations = (draftLine.allocations || []).map((allocation) => (decision === "add" && rooms.has(keyOf(allocation)) ? { ...allocation, additional: true } : allocation));
  const saved = withAllocations(stamp(draftLine, decision === "replace" ? "replace" : "add-another", { locations: conflicts.map((conflict) => conflict.location).join(", ") }, now), allocations);
  return next.some((line) => line.lineId === saved.lineId) ? next.map((line) => (line.lineId === saved.lineId ? saved : line)) : [...next, saved];
}
