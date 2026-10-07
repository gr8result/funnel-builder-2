import { createSelectionPayloadFromProduct } from "./clientSelectionWorkflow.js";

export const CABINETRY_ROOMS = [
  ["kitchen", "Kitchen"], ["butlers-pantry", "Butler's Pantry"], ["pantry", "Pantry"],
  ["laundry", "Laundry"], ["bathroom", "Bathroom"], ["ensuite", "Ensuite"],
  ["powder-room", "Powder Room"], ["kitchenette", "Kitchenette"],
].map(([key, label]) => ({ key, label }));

const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const active = (row) => row.is_active !== false && !["replaced", "removed"].includes(row.selection_status || row.status);
const timestamp = (row) => String(row.updated_at || row.selected_at || row.created_at || "");

export function cabinetryRoomKey(value = "") {
  const key = String(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (key === "butler-pantry") return "butlers-pantry";
  return key === "powder" ? "powder-room" : key;
}

export function defaultCabinetryRoom(roomKey, existing = {}) {
  const key = cabinetryRoomKey(roomKey || existing.roomKey || existing.roomLabel || "kitchen");
  return {
    configuration: { components: {}, quantities: {} }, finish: null,
    internals: {}, kickboard: {}, handles: {}, benchtop: { fabrication: {} },
    hardware: {}, specialFeatures: {}, ...existing,
    roomKey: key,
    roomLabel: existing.roomLabel || CABINETRY_ROOMS.find((room) => room.key === key)?.label || String(roomKey),
  };
}

// Copy specifications, never record identity or the destination's retained legacy evidence.
export function copyCabinetryRoom(source, destination, mode = "colours") {
  const next = clone(destination);
  const sections = mode === "complete"
    ? ["configuration", "finish", "internals", "kickboard", "handles", "benchtop", "hardware", "specialFeatures"]
    : ["finish"];
  sections.forEach((section) => { next[section] = clone(source[section]); });
  if (mode !== "complete") {
    // Finish references only: do not enable exposed shelves or change internal/kickboard construction.
    next.internals = { ...next.internals };
    ["product", "finish", "exposedFinish", "openShelfFinish", "featureShelfFinish"].forEach((key) => {
      if (source.internals?.[key] != null) next.internals[key] = clone(source.internals[key]);
    });
    if (source.kickboard?.type === next.kickboard?.type && source.kickboard?.product) {
      next.kickboard = { ...next.kickboard, product: clone(source.kickboard.product) };
    }
  }
  return next;
}

function roomFromSelection(row) {
  const details = object(row.selected_details);
  if (details.cabinetryRoom?.roomKey) return cabinetryRoomKey(details.cabinetryRoom.roomKey);
  const key = details.requirementKey || row.metadata?.requirementKey || "";
  return typeof key === "string" && key.startsWith("cabinetry:") ? cabinetryRoomKey(key.slice(10)) : "";
}

export function cabinetrySelectionsForScope(selections, { workspaceId, projectId, sessionId, snapshotId }) {
  if (!workspaceId || !projectId) return [];
  return selections.filter((row) => {
    if (row.workspace_id !== workspaceId || row.project_id !== projectId) return false;
    const legacy = !roomFromSelection(row) && isLegacyCabinetry(row);
    // Older project-level selections may predate sessions. Keep them as legacy evidence,
    // while modern room records always match the selected session and snapshot exactly.
    return (((row.session_id || null) === (sessionId || null)) || (legacy && !row.session_id))
      && (((row.snapshot_id || null) === (snapshotId || null)) || (legacy && !row.snapshot_id));
  });
}

export function isSameCabinetryRoomSelection(row, payload) {
  const key = roomFromSelection(payload);
  return Boolean(key && key === roomFromSelection(row) && active(row)
    && ["workspace_id", "project_id", "session_id", "snapshot_id"].every((field) => (row[field] || null) === (payload[field] || null)));
}

function isLegacyCabinetry(row) {
  const details = object(row.selected_details);
  const keys = [details.requirementKey, row.metadata?.requirementKey, details.familyKey, row.metadata?.familyKey, row.subcategory];
  return Boolean(details.cabinetrySelection || keys.some((key) => String(key || "").toLowerCase() === "cabinetry") || row.category === "cabinetry");
}

function legacyProduct(value, fallback = {}) {
  const source = object(value);
  if (!Object.keys(source).length && !Object.values(fallback).some(Boolean)) return null;
  return {
    ...clone(source),
    id: source.id || source.productId || source.productCode || fallback.id || "",
    productId: source.productId || source.id || fallback.productId || "",
    productCode: source.productCode || source.colourCode || source.sku || fallback.productCode || "",
    productName: source.productName || source.colourName || source.name || fallback.productName || "",
    brand: source.brand || source.supplier || fallback.brand || "",
    colour: source.colour || source.colourName || fallback.colour || "",
    finish: source.finish || fallback.finish || "",
  };
}

function mapLegacyRoom(row, location = null) {
  const details = object(row.selected_details);
  const source = location || object(details.cabinetrySelection);
  const label = location?.location || location?.name || (row.room && row.room !== "Cabinetry" ? row.room : "Kitchen");
  const room = defaultCabinetryRoom(label, { roomLabel: label });
  room.finish = legacyProduct(source.defaultColour || source.areaSelections?.lowerDoorsDrawers || details.product, {
    productId: details.productId, productCode: details.productCode,
    productName: details.productName || row.selected_product_name || row.product_name,
    brand: details.brand || row.brand || row.selected_supplier_name,
    colour: details.colour || row.selected_colour || row.colour, finish: details.finish || row.selected_finish || row.finish,
  });
  if (source.areaSelections?.cabinetInteriors) room.internals.exposedFinish = legacyProduct(source.areaSelections.cabinetInteriors);
  if (source.areaSelections?.openShelving) room.internals.openShelfFinish = legacyProduct(source.areaSelections.openShelving);
  // Retain the complete original record. Unsupported schedules, per-area finishes and old
  // handle/benchtop shapes remain recoverable without guessing at a new configuration.
  room.legacySelections = [clone(row)];
  room.legacyReviewRequired = true;
  return room;
}

export function hydrateCabinetryRooms(selections = []) {
  const rooms = {};
  const rows = selections.filter(active).slice().sort((a, b) => timestamp(b).localeCompare(timestamp(a)));
  rows.forEach((row) => {
    const key = roomFromSelection(row);
    if (key && !rooms[key]) rooms[key] = defaultCabinetryRoom(key, clone(row.selected_details?.cabinetryRoom));
  });
  rows.filter((row) => !roomFromSelection(row) && isLegacyCabinetry(row)).forEach((row) => {
    const locations = row.selected_details?.cabinetrySelection?.locations;
    const mapped = Array.isArray(locations) && locations.length
      ? locations.map((location) => mapLegacyRoom(row, location)) : [mapLegacyRoom(row)];
    mapped.forEach((room) => {
      if (!rooms[room.roomKey]) rooms[room.roomKey] = room;
      else if (rooms[room.roomKey].legacyReviewRequired && !rooms[room.roomKey].legacySelections?.some((saved) => saved.id === row.id)) {
        rooms[room.roomKey].legacySelections.push(clone(row));
      }
    });
  });
  return rooms;
}

export function buildCabinetryRoomSelectionPayload({ workspaceId, projectId, snapshotId, sessionId, userId = null, room } = {}) {
  const specification = clone(defaultCabinetryRoom(room.roomKey, room));
  const finish = specification.finish || {};
  const materialProduct = specification.benchtop?.product;
  const materialPending = Boolean(specification.benchtop?.material && specification.benchtop.material !== "none"
    && (!materialProduct || (materialProduct.requiresVariantSelection && !materialProduct.variantId)));
  const key = `cabinetry:${specification.roomKey}`;
  const productName = `${specification.roomLabel} cabinetry${finish.productName || finish.colourName ? ` — ${finish.productName || finish.colourName}` : ""}`;
  const payload = createSelectionPayloadFromProduct({
    workspaceId, projectId, snapshotId, sessionId, userId,
    requirement: { areaKey: "cabinetry", areaLabel: specification.roomLabel, requirementKey: key, label: `Cabinetry — ${specification.roomLabel}`, familyKey: "cabinetry", unit: "ITEM", defaultQuantity: 1, defaultAllowance: 0 },
    product: { ...finish, productName, supplier: finish.supplier || finish.brand || "", priceStatus: "quote_required" },
  });
  return {
    ...payload,
    // These numeric columns are NOT NULL in the existing schema. Unknown prices live in JSON.
    client_selection_price: 0, calculated_client_selection_price: 0, variation_amount: 0,
    included_in_contract: false, is_included_selection: false,
    status: materialPending ? "pending" : "selected",
    selection_status: materialPending ? "not_selected" : "selected",
    selected_details: {
      ...payload.selected_details, selectionType: "cabinetry_room", schemaVersion: 1,
      roomKey: specification.roomKey, room: specification.roomLabel,
      selectionKey: key, configurationComplete: !materialPending, materialSelectionPending: materialPending, cabinetryRoom: specification,
      selectedPrice: null, variationAmount: null, variationPending: true, priceState: "Quote Required",
    },
    metadata: { ...payload.metadata, selectionType: "cabinetry_room", roomKey: specification.roomKey, selectionKey: key },
  };
}

export function applySavedCabinetryRoom(selections, inserted, replacedIds = []) {
  const retired = new Set(replacedIds);
  return [inserted, ...selections.filter((row) => row.id !== inserted.id).map((row) => retired.has(row.id)
    ? { ...row, is_active: false, selection_status: "replaced", status: "changed" } : row)];
}

export async function persistCabinetryRoomSelection({ supabase, payload, selections = [], columns = "*" }) {
  const previous = selections.filter((row) => isSameCabinetryRoomSelection(row, payload));
  // Insert before retirement so a failed insert cannot erase a saved specification.
  const { data: inserted, error } = await supabase.from("builder_client_selections").insert(payload).select(columns).single();
  if (error) throw error;
  const replacedIds = [];
  let warning = "";
  if (previous.length) {
    let query = supabase.from("builder_client_selections").update({
      selection_status: "replaced", status: "changed", is_active: false,
      updated_by: payload.updated_by, updated_at: new Date().toISOString(),
    }).eq("workspace_id", payload.workspace_id).eq("project_id", payload.project_id)
      .eq("selected_details->>requirementKey", payload.selected_details.requirementKey)
      .in("id", previous.map((row) => row.id));
    for (const field of ["session_id", "snapshot_id"]) query = payload[field] ? query.eq(field, payload[field]) : query.is(field, null);
    const { data: retired, error: retireError } = await query.select("id");
    if (!retireError) replacedIds.push(...(retired || []).map((row) => row.id));
    if (retireError || replacedIds.length !== previous.length) warning = "Room saved, but its previous revision could not be marked replaced. Reload before editing it again.";
  }
  return { inserted, replacedIds, warning };
}
