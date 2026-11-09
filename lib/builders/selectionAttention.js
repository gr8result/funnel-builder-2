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
import { plumbingAllocationLocationKey, plumbingAllocationProgress, plumbingLocationKey } from "./plumbingFixtureAllocation.js";
import { scheduleRowNeedsProductImage } from "./selectionsScheduleDocument.js";
import { guidedRequirementByKey, statusForRequirement } from "./clientSelectionWorkflow.js";
import { isCabinetryRoomApproved, cabinetryLocationMissingRequirements, normaliseCabinetrySelection } from "./cabinetryWorkflow.js";

export const ATTENTION_GROUPS = [
  { key: "decisions", title: "Client decisions requiring completion" },
  { key: "duplicates", title: "Actual duplicate / conflicting selections" },
  { key: "specifications", title: "Missing specifications" },
  { key: "pricing", title: "Template pricing and builder overrides" },
  { key: "contract", title: "Contract approval requirements" },
  { key: "project", title: "Project setup requirements" },
];

const text = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const guidedRows = (book = {}) => (book?.rooms || []).flatMap((room) => (room.rows || []).filter((row) => row?.guidedSelection));
const keyOfRow = (row) => text(row.guidedRequirementKey || row.guidedSelection?.requirementKey);
const labelOf = (row) => text(row.guidedSelection?.requirementLabel) || keyOfRow(row);
// A room normally takes ONE product of these per fixture position, so two different products in the
// same room are worth a look. Lighting, shower sets and mixers legitimately mix products in a room.
export const MULTI_PRODUCT_REQUIREMENTS = new Set(["interior-lighting", "external-lighting", "shower-fixtures", "bath-mixer", "tiling-rooms", "interior-flooring"]);
const decisionState = (row) => {
  const guided = row.guidedSelection || {};
  const product = text(guided.productName || guided.selectedProduct);
  const requirement = guidedRequirementByKey(keyOfRow(row));
  const savedStatus = row.status || guided.selectionStatus || guided.status;
  const workflowStatus = statusForRequirement(requirement, { selection_status: savedStatus, status: savedStatus, selected_details: guided });
  let detail = product;
  const allocation = plumbingAllocationProgress(guided);
  if (allocation.required && !allocation.complete) detail = `${product}. ${allocation.allocated} of ${allocation.required} allocated; ${allocation.remaining} still require selection or allocation.`;
  const incompleteTiling = Array.isArray(guided.tilingRoomStatuses) ? guided.tilingRoomStatuses.filter((room) => room.status !== "complete") : [];
  if (incompleteTiling.length) detail = `${product}. ${incompleteTiling.map((room) => `${text(room.roomName)}: ${(room.missing || []).map(text).join(", ") || "selection incomplete"}`).join("; ")}.`;
  return { product, detail, pending: !product || workflowStatus !== "complete" };
};

export function selectionDecisionSummary(book = {}) {
  const rows = guidedRows(book);
  const outstanding = rows.filter((row) => decisionState(row).pending);
  return { total: rows.length, complete: rows.length - outstanding.length, outstanding: outstanding.length, rowIds: outstanding.map((row) => row.id) };
}

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
const money = (value) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 2 }).format(Number(value));
const priceReference = (product = {}) => {
  const price = Number(product.retailReferencePrice);
  if (!(price > 0)) return null;
  const unit = text(product.retailReferenceUnit || product.priceUnit);
  const gst = /incl|inclusive/i.test(text(product.retailReferenceGstBasis)) ? "inc GST" : /excl|exclusive/i.test(text(product.retailReferenceGstBasis)) ? "ex GST" : "GST basis noted in source";
  return { price, unit, gst, sourceType: product.retailReferenceType };
};

function pricingAttentionState(row, productLookup) {
  const guided = row.guidedSelection || {};
  const lines = guided.plumbingAllocation?.lines || [];
  const products = lines.length ? lines : [guided];
  const entries = products.map((product) => {
    const name = text(product.productName || guided.productName || guided.selectedProduct);
    const savedPrice = Number(product.unitPrice ?? product.selectedPrice);
    const catalogue = productLookup?.(product.productId, product.productCode) || {};
    const reference = priceReference(catalogue);
    if (savedPrice > 0) return { kind: "builder", detail: `${name}: builder price ${money(savedPrice)} each. This is the current builder override and still requires confirmation before contract issue.` };
    if (reference) {
      const source = reference.sourceType === "verified_supplier" ? "Indicative supplier reference" : "Indicative GR8 Result reference";
      return { kind: "template", detail: `${name}: ${source} ${money(reference.price)}${reference.unit ? ` per ${reference.unit}` : ""} (${reference.gst}). Status: Template estimate.` };
    }
    return { kind: "missing", detail: `${name || labelOf(row)}: PRICE REQUIRED. No valid builder price or indicative template reference is available.` };
  });
  const kinds = new Set(entries.map((entry) => entry.kind));
  const kind = kinds.has("missing") ? "missing" : kinds.has("builder") ? "builder" : "template";
  return {
    kind,
    detail: entries.map((entry) => entry.detail).join(" "),
    status: kind === "missing" ? "PRICE REQUIRED" : kind === "builder" ? "Builder price override" : "Template estimate",
    actionLabel: kind === "missing" ? "ADD BUILDER PRICE" : kind === "builder" ? "EDIT BUILDER PRICE" : "REPLACE WITH BUILDER PRICE",
  };
}

export function selectionAttention({ book = {}, rooms = [], model = { rooms: [] }, schedule = null, review = null, preflight = null, productLookup = null } = {}) {
  const items = [];
  const add = (group, title, detail, action, blocking = true, metadata = {}) => items.push({ id: `${group}:${items.length}:${title}`, group, title: text(title), detail: text(detail), blocking, action, ...metadata });
  const open = (row, label) => ({ kind: "selection", label, rowId: row?.id || "" });
  const pricingRows = [];

  // -- Rooms and duplicates ------------------------------------------------------------------------
  if (!projectRoomsConfirmed(model)) add("project", "Project rooms", "The room list has not been confirmed. Confirm the rooms and levels so every selection is made against the right room.", { kind: "rooms", label: "CONFIRM ROOMS" }, false);
  const overlaps = overlappingAssignments(book, rooms);
  possibleDuplicateRooms(rooms, model).forEach(({ rooms: [left, right] }) => add("duplicates", `Rooms — ${left.name} / ${right.name}`, "These may be the same room under two names. Confirm whether they are one room or two.", { kind: "rooms", label: "RESOLVE DUPLICATE" }));
  unlistedSelectionLocations(book, rooms, model).forEach((location) => {
    if (location.suggestion) add("duplicates", `${location.usedBy.slice(0, 3).join(", ")}${location.usedBy.length > 3 ? " and more" : ""} — ${location.name}`, `These selections are saved against "${location.name}", which looks like the room ${location.suggestion.name}. Until they are joined the room can appear twice and be counted twice.`, { kind: "rooms", label: "RESOLVE DUPLICATE" });
    // A level used in place of a room is reported once, with its quantities, as an overlap below.
    else if (overlaps.some((overlap) => overlap.kind === "grouped-and-by-room" && overlap.grouped.some((entry) => plumbingLocationKey(entry.location) === location.key))) return;
    else add("specifications", `${location.usedBy.join(", ")} — ${location.name}`, `"${location.name}" is not one of the project's rooms. Say which room it is, or add it as a location.`, { kind: "rooms", label: "CHOOSE ROOM" });
  });
  overlaps.forEach((overlap) => {
    if (overlap.kind === "two-products") add("duplicates", `${overlap.requirementLabel} — ${overlap.location}`, `Two different products are assigned to this room: ${overlap.products.map((product) => `${product.name} × ${product.quantity}`).join(" and ")}. Confirm both are required, or remove one.`, open(overlap.row, "RESOLVE DUPLICATE"));
    else add("duplicates", `${overlap.requirementLabel} — ${overlap.grouped.map((entry) => `${entry.location} × ${entry.quantity}`).join(", ")}`, `${overlap.total - overlap.byRoomQuantity} are allocated to a level rather than a room, as well as ${overlap.byRoomQuantity} allocated room by room (${overlap.total} in total). Allocate each one to its room so none is counted twice.`, open(overlap.row, "RESOLVE DUPLICATE"));
  });

  // The same product allocated to the same room under two different categories (e.g. a shower mixer under
  // Shower Fixtures and again under Bath & Shower Mixer) may be counted twice. Only the builder can say
  // which category owns it, so it is flagged, never changed.
  crossCategoryDuplicates(book).forEach((entry) => add("duplicates", `${entry.product} — ${entry.room}`,
    `Selected for this room under ${entry.owners.map((owner) => `${owner.label} (×${owner.quantity}${owner.fixture ? `, ${owner.fixture}` : ""})`).join(" and ")}. Confirm it is not counted twice.`,
    open(entry.row, "REVIEW SELECTION")));

  // -- Client decisions, specifications, pricing ---------------------------------------------------
  guidedRows(book).forEach((row) => {
    const guided = row.guidedSelection;
    const label = labelOf(row);
    const { product, detail: decisionDetail, pending: decisionPending } = decisionState(row);
    const cabinetry = guided.cabinetrySelection;
    if (cabinetry?.locations?.length) {
      const selection = normaliseCabinetrySelection(cabinetry, model);
      selection.locations.filter(room => !isCabinetryRoomApproved(room, selection.schedule, selection.projectId)).forEach(room => {
        const missing = cabinetryLocationMissingRequirements(room);
        add("decisions", `Cabinetry — ${room.location}`, missing.length
          ? `Complete the ${room.location} specification: ${missing.map(item => item.label).join(", ")}. Then explicitly approve this room.`
          : `${room.location} specification is complete. Review its existing selections and quantities, then Confirm & Approve ${room.location} Cabinetry.`,
        // One click to that room's Review & Confirm step (selections-book reads cabinetryRoom / cabinetryStage).
        { ...open(row, `REVIEW & APPROVE ${room.location.toUpperCase()} CABINETRY →`), roomId: room.projectRoomId || room.id, roomName: room.location, cabinetryStage: "review" });
      });
    } else if (!product) add("decisions", label, "Nothing has been selected yet.", open(row, "CHOOSE SELECTION"));
    else if (decisionPending) add("decisions", label, decisionDetail || `${product}. This selection has been started but not confirmed.`, open(row, "REVIEW SELECTION"));
    (guided.plumbingAllocation?.lines || []).forEach((line) => (line.allocations || []).filter((allocation) => plumbingAllocationLocationKey(allocation) === "unallocated" && Number(allocation.quantity) > 0)
      .forEach((allocation) => add("specifications", `${label} — ${text(line.productName)}`, `${allocation.quantity} ${Number(allocation.quantity) === 1 ? "has" : "have"} no room allocated. Choose where it goes.`, open(row, "CHOOSE ROOM"))));
    // No pricing warning for a choice that cannot change the price: the package's own baseline product,
    // or a known price within the allowance (it can only be equal or a credit).
    const baselineKept = Boolean(guided.standardInclusionBaseline?.productId) && text(guided.standardInclusionBaseline.productId) === text(guided.productId || guided.selectedProductId || row.selectedOptionId);
    const knownPrice = Number(guided.selectedPrice);
    const knownAllowance = Number(guided.allowance ?? row.allowanceAmount);
    const withinAllowance = knownPrice > 0 && knownAllowance > 0 && knownPrice <= knownAllowance && !(guided.plumbingAllocation?.lines?.length > 1);
    if (product && !decisionPending && !baselineKept && !withinAllowance && (/quote|pending/i.test(text(guided.priceStatus || guided.priceState)) || guided.variationPending === true)) {
      const pricing = pricingAttentionState(row, productLookup);
      pricingRows.push({ row, pricing });
      add("pricing", `${label} — ${product}`, pricing.detail, open(row, pricing.actionLabel), false, { status: pricing.status, statusTone: pricing.kind });
    }
  });

  // -- Product images (not a client decision, but required before final contract issue) ------------
  const missingImages = (schedule?.rows || []).filter(scheduleRowNeedsProductImage);
  missingImages.forEach((row) => add("specifications", [row.item, row.product].filter(Boolean).join(" — "), "The product image is missing or still uses a placeholder. Select or approve the correct product image.", { kind: "selection", label: "FIX IMAGE", rowId: row.sourceRowId }, true, { status: "Image approval required", statusTone: "contract" }));

  // -- Project information ------------------------------------------------------------------------
  const PROJECT_ACTIONS = { "Builder logo loaded": ["Builder logo", "No valid logo is attached.", "UPLOAD LOGO"], "Client loaded": ["Client name", "The client's name is missing.", "ADD CLIENT"], "Address loaded": ["Site address", "The site address is missing.", "ADD ADDRESS"],
    "Job number loaded": ["Job number", "The job number is missing.", "ADD JOB NUMBER"], "Builder/company loaded": ["Builder / company", "The builder's name is missing.", "ADD BUILDER"] };
  (preflight?.checks || []).filter((check) => !check.ok).forEach((check) => { const [title, detail, label] = PROJECT_ACTIONS[check.label] || [check.label, "This project detail is missing.", "FIX PROJECT DETAILS"]; add("specifications", `Project Details — ${title}`, detail, { kind: "project", label }); });

  const pricing = pricingRows.reduce((result, entry) => ({ ...result, [entry.pricing.kind]: (result[entry.pricing.kind] || 0) + 1 }), { template: 0, builder: 0, missing: 0 });
  if (pricingRows.length) {
    const detail = [
      pricing.template ? `${pricing.template} template estimate${pricing.template === 1 ? "" : "s"} may be used in draft schedules.` : "",
      pricing.builder ? `${pricing.builder} builder price override${pricing.builder === 1 ? "" : "s"} await contract confirmation.` : "",
      pricing.missing ? `${pricing.missing} item${pricing.missing === 1 ? " genuinely requires" : "s genuinely require"} a price.` : "",
      "Before issuing a final contract schedule, the builder must replace or explicitly confirm every indicative price. No price is automatically approved.",
    ].filter(Boolean).join(" ");
    add("contract", "Builder confirmation of contract pricing", detail, open(pricingRows[0].row, "REVIEW CONTRACT PRICING"), true, { status: "Required before final contract issue", statusTone: "contract" });
  }

  const groups = ATTENTION_GROUPS
    .map((group) => ({ ...group, items: items.filter((item) => item.group === group.key) }))
    .filter((group) => group.items.length > 0);
  const decisions = items.filter((item) => item.group === "decisions").length;
  return { groups, total: items.length, blocking: items.filter((item) => item.blocking).length,
    // Completion: client decisions only. Readiness: everything that blocks issuing the contract schedule.
    completion: { outstandingDecisions: decisions, complete: decisions === 0 }, pricing,
    readiness: { blockingItems: items.filter((item) => item.blocking).length, ready: !items.some((item) => item.blocking) } };
}

export function crossCategoryDuplicates(book = {}) {
  const byProductRoom = new Map();
  guidedRows(book).forEach((row) => {
    const requirement = row.guidedRequirementKey || row.guidedSelection?.requirementKey || "";
    (row.guidedSelection?.plumbingAllocation?.lines || []).forEach((line) => {
      const product = text(line.productId || line.productName).toLowerCase();
      if (!product) return;
      (line.allocations || []).filter((allocation) => Number(allocation.quantity) > 0).forEach((allocation) => {
        const room = plumbingAllocationLocationKey(allocation);
        if (!room || room === "unallocated") return;
        const key = `${product}|${room}`;
        const entry = byProductRoom.get(key) || { product: text(line.productName), room: text(allocation.location), row, owners: new Map() };
        const owner = entry.owners.get(requirement) || { label: labelOf(row), quantity: 0, fixture: text(allocation.fixture) };
        owner.quantity += Number(allocation.quantity) || 0;
        entry.owners.set(requirement, owner);
        byProductRoom.set(key, entry);
      });
    });
  });
  return [...byProductRoom.values()].filter((entry) => entry.owners.size > 1).map((entry) => ({ ...entry, owners: [...entry.owners.values()] }));
}
