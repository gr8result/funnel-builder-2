// SELECTIONS REQUIRING YOUR ATTENTION.
//
// One list of everything a builder has to act on before the selections schedule can be issued, in
// place of an unexplained count. Each item says what is wrong, which room or product it affects,
// what to do, whether it blocks final approval, and carries the action that resolves it:
//   { id, group, title, detail, blocking, action: { kind, label, rowId? } }
//   action.kind: "rooms" (open Room Setup) | "selection" (open that selection) | "project" (open project / cover details)
//
// Completion and readiness are separate things. A client decision is COMPLETE when a product or
// finish is chosen; a missing image or an unconfirmed supplier price never makes a chosen product
// "incomplete" - it is a readiness item of its own group.

import { possibleDuplicateRooms, projectRoomsConfirmed, unlistedSelectionLocations } from "./projectRoomModel.js";
import { plumbingAllocationLocationKey, plumbingLocationKey } from "./plumbingFixtureAllocation.js";

export const ATTENTION_GROUPS = [
  { key: "decisions", title: "Client decisions" },
  { key: "duplicates", title: "Duplicate / conflicting selections" },
  { key: "specifications", title: "Missing specifications" },
  { key: "pricing", title: "Pricing / variation approvals" },
  { key: "images", title: "Product images" },
  { key: "project", title: "Project information" },
  { key: "sync", title: "Quotation / BOQ synchronisation" },
];

const text = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const guidedRows = (book = {}) => (book?.rooms || []).flatMap((room) => (room.rows || []).filter((row) => row?.guidedSelection));
const keyOfRow = (row) => text(row.guidedRequirementKey || row.guidedSelection?.requirementKey);
const labelOf = (row) => text(row.guidedSelection?.requirementLabel) || keyOfRow(row);
// A room normally takes ONE product of these per fixture position, so two different products in the
// same room are worth a look. Lighting, shower sets and mixers legitimately mix products in a room.
export const MULTI_PRODUCT_REQUIREMENTS = new Set(["interior-lighting", "external-lighting", "shower-fixtures", "bath-mixer", "tiling-rooms", "interior-flooring"]);
// Rows of these schedule groups are products a client expects to see pictured.
const IMAGE_GROUPS = new Set(["entry-doors", "garage-door", "external-lighting", "external-balustrades", "appliances", "plumbing-fixtures", "bathroom-accessories", "shower-screens-mirrors", "tiles-stone", "internal-doors", "fix-out", "wardrobes", "stairs-balustrades", "lighting-fans", "hvac", "hot-water", "flooring"]);

// Overlapping assignments, for review - never removed automatically:
//   [{ kind: "two-products", row, requirementLabel, location, products: [{ name, quantity }] }]
//   [{ kind: "grouped-and-by-room", row, requirementLabel, grouped: [{ location, quantity }], byRoomQuantity, total }]
export function overlappingAssignments(book = {}, rooms = []) {
  const roomKeys = new Set(rooms.map((room) => room.key));
  const found = [];
  guidedRows(book).forEach((row) => {
    const requirementKey = keyOfRow(row);
    const lines = row.guidedSelection.plumbingAllocation?.lines || [];
    if (!lines.length || MULTI_PRODUCT_REQUIREMENTS.has(requirementKey)) return;
    const byLocation = new Map();
    lines.forEach((line) => (line.allocations || []).forEach((allocation) => {
      const quantity = Number(allocation.quantity) || 0;
      const key = plumbingAllocationLocationKey(allocation);
      if (!(quantity > 0) || !key || key === "unallocated") return;
      const entry = byLocation.get(key) || { location: text(allocation.location), products: [] };
      entry.products.push({ name: text(line.productName), quantity });
      byLocation.set(key, entry);
    }));
    byLocation.forEach((entry) => {
      const names = new Set(entry.products.map((product) => product.name));
      if (names.size > 1) found.push({ kind: "two-products", row, requirementLabel: labelOf(row), location: entry.location, products: entry.products });
    });
    // Some quantity sits against a whole level or the house ("Upstairs x5") while the same
    // requirement is also allocated room by room: the same fixtures may be counted twice.
    const grouped = [...byLocation].filter(([key]) => !roomKeys.has(key) && ![...roomKeys].some((roomKey) => key.startsWith(`${roomKey}-`)) && /^(upstairs|downstairs|ground|upper|lower|first|second|third|whole|house|all|level)/.test(key));
    const byRoom = [...byLocation].filter(([key]) => roomKeys.has(key));
    if (grouped.length && byRoom.length) {
      const sum = (list) => list.reduce((total, [, entry]) => total + entry.products.reduce((count, product) => count + product.quantity, 0), 0);
      found.push({ kind: "grouped-and-by-room", row, requirementLabel: labelOf(row), grouped: grouped.map(([, entry]) => ({ location: entry.location, quantity: entry.products.reduce((count, product) => count + product.quantity, 0) })), byRoomQuantity: sum(byRoom), total: sum(grouped) + sum(byRoom) });
    }
  });
  return found;
}

// preflight: { checks: [{ label, ok }] } from the page's project preflight. schedule: buildSelectionsSchedule() result.
export function selectionAttention({ book = {}, rooms = [], model = { rooms: [] }, schedule = null, preflight = null } = {}) {
  const items = [];
  const add = (group, title, detail, action, blocking = true) => items.push({ id: `${group}:${items.length}:${title}`, group, title: text(title), detail: text(detail), blocking, action });
  const open = (row, label) => ({ kind: "selection", label, rowId: row?.id || "" });

  // -- Rooms and duplicates ------------------------------------------------------------------------
  if (!projectRoomsConfirmed(model)) add("project", "Project rooms", "The room list has not been confirmed. Confirm the rooms and levels so every selection is made against the right room.", { kind: "rooms", label: "CONFIRM ROOMS" }, false);
  const overlaps = overlappingAssignments(book, rooms);
  possibleDuplicateRooms(rooms, model).forEach(({ rooms: [left, right] }) => add("duplicates", `Rooms — ${left.name} / ${right.name}`, "These may be the same room under two names. Confirm whether they are one room or two.", { kind: "rooms", label: "RESOLVE DUPLICATE" }));
  unlistedSelectionLocations(book, rooms, model).forEach((location) => {
    if (location.suggestion) add("duplicates", `${location.usedBy.slice(0, 3).join(", ")}${location.usedBy.length > 3 ? " and more" : ""} — ${location.name}`, `These selections are saved against "${location.name}", which looks like the room ${location.suggestion.name}. Until they are joined the room can appear twice and be counted twice.`, { kind: "rooms", label: "RESOLVE DUPLICATE" });
    // A level used in place of a room is reported once, with its quantities, as an overlap below.
    else if (overlaps.some((overlap) => overlap.kind === "grouped-and-by-room" && overlap.grouped.some((entry) => plumbingLocationKey(entry.location) === location.key))) return;
    else add("specifications", `${location.usedBy.join(", ")} — ${location.name}`, `"${location.name}" is not one of the project's rooms. Say which room it is, or add it as a location.`, { kind: "rooms", label: "CHOOSE ROOM" }, false);
  });
  overlaps.forEach((overlap) => {
    if (overlap.kind === "two-products") add("duplicates", `${overlap.requirementLabel} — ${overlap.location}`, `Two different products are assigned to this room: ${overlap.products.map((product) => `${product.name} × ${product.quantity}`).join(" and ")}. Confirm both are required, or remove one.`, open(overlap.row, "RESOLVE DUPLICATE"));
    else add("duplicates", `${overlap.requirementLabel} — ${overlap.grouped.map((entry) => `${entry.location} × ${entry.quantity}`).join(", ")}`, `${overlap.total - overlap.byRoomQuantity} are allocated to a level rather than a room, as well as ${overlap.byRoomQuantity} allocated room by room (${overlap.total} in total). Allocate each one to its room so none is counted twice.`, open(overlap.row, "RESOLVE DUPLICATE"));
  });

  // -- Client decisions, specifications, pricing ---------------------------------------------------
  guidedRows(book).forEach((row) => {
    const guided = row.guidedSelection;
    const label = labelOf(row);
    const status = text(guided.selectionStatus || row.status).toLowerCase();
    const product = text(guided.productName || guided.selectedProduct);
    if (!product) add("decisions", label, "Nothing has been selected yet.", open(row, "CHOOSE SELECTION"));
    else if (["pending", "in_progress", "draft"].includes(status)) add("decisions", label, `${product}. This selection has been started but not confirmed.`, open(row, "REVIEW SELECTION"));
    (guided.plumbingAllocation?.lines || []).forEach((line) => (line.allocations || []).filter((allocation) => plumbingAllocationLocationKey(allocation) === "unallocated" && Number(allocation.quantity) > 0)
      .forEach((allocation) => add("specifications", `${label} — ${text(line.productName)}`, `${allocation.quantity} ${Number(allocation.quantity) === 1 ? "has" : "have"} no room allocated. Choose where it goes.`, open(row, "CHOOSE ROOM"))));
    if (product && (/quote|pending/i.test(text(guided.priceStatus || guided.priceState)) || guided.variationPending === true)) add("pricing", `${label} — ${product}`, "The supplier price or variation has not been confirmed. The selection itself stands.", open(row, "CONFIRM PRICE"), false);
  });

  // -- Product images (never a completion issue) ---------------------------------------------------
  (schedule?.rows || []).filter((row) => IMAGE_GROUPS.has(row.group) && !row.imageUrl && row.status !== "TBC").forEach((row) => add("images", `${row.item} — ${row.product}`, "No product image is attached. Select or approve the correct product image.", { kind: "selection", label: "FIX IMAGE", rowId: row.sourceRowId }, false));

  // -- Project information ------------------------------------------------------------------------
  const PROJECT_ACTIONS = { "Builder logo loaded": ["Builder logo", "No valid logo is attached.", "UPLOAD LOGO"], "Client loaded": ["Client name", "The client's name is missing.", "ADD CLIENT"], "Address loaded": ["Site address", "The site address is missing.", "ADD ADDRESS"],
    "Job number loaded": ["Job number", "The job number is missing.", "ADD JOB NUMBER"], "Builder/company loaded": ["Builder / company", "The builder's name is missing.", "ADD BUILDER"] };
  (preflight?.checks || []).filter((check) => !check.ok).forEach((check) => { const [title, detail, label] = PROJECT_ACTIONS[check.label] || [check.label, "This project detail is missing.", "FIX PROJECT DETAILS"]; add("project", `Project Details — ${title}`, detail, { kind: "project", label }); });

  const groups = ATTENTION_GROUPS.map((group) => ({ ...group, items: items.filter((item) => item.group === group.key) })).filter((group) => group.items.length);
  const decisions = items.filter((item) => item.group === "decisions").length;
  return { groups, total: items.length, blocking: items.filter((item) => item.blocking).length,
    // Completion: client decisions only. Readiness: everything that blocks issuing the contract schedule.
    completion: { outstandingDecisions: decisions, complete: decisions === 0 }, readiness: { blockingItems: items.filter((item) => item.blocking).length, ready: !items.some((item) => item.blocking) } };
}
