// Tiles & Stone as a room-by-room tiling specification (Client Selections).
//
// The whole tiling selection is ONE selection-book row (requirementKey "tiling-rooms"), so it is
// persisted and projected into builder_client_selections exactly like every other guided selection.
// Its guidedSelection.tilingRooms holds each room: id, name, type, specification, dimensions,
// components, openings, wastage, chosen Product Library tile ids per surface slot, and floor wastes;
// every calculated figure is rebuilt from those inputs by tilingCalculations.js.
import { calculateTilingRoom, DEFAULT_TILE_WASTAGE_PCT, isFloorAreaRoom, TILING_DIMENSION_UNIT, TILING_ROOM_TYPES, tilingRoomInMm, tilingRoomStatus, tilingRoomType } from "./tilingCalculations.js";
import { plumbingAllocationApplication, plumbingLinesFromSelection } from "./plumbingFixtureAllocation.js";

export const TILING_REQUIREMENT_KEY = "tiling-rooms";
export const LEGACY_TILE_REQUIREMENT_KEYS = ["floor-tiles", "wall-tiles", "feature-tiles", "external-tiles", "mosaics"];
export const LEGACY_FLOOR_WASTE_KEY = "floor-waste";
export const TILING_SLOTS = Object.freeze([
  { slot: "floor", label: "Floor tile", application: "floor" },
  { slot: "wall", label: "Wall tile", application: "wall" },
  { slot: "splashback", label: "Splashback tile", application: "wall" },
  { slot: "feature", label: "Feature tile", application: "wall" },
  { slot: "mosaic", label: "Mosaic", application: "" },
]);

const ROOM_TYPE_PATTERNS = [
  ["butlers-pantry", /butler|scullery/i], ["powder-room", /powder|\bw\.?c\b/i], ["ensuite", /ensuite|en[\s-]suite/i],
  ["laundry", /laundry/i], ["kitchen", /kitchen/i], ["pool-area", /pool/i], ["alfresco", /alfresco/i],
  ["balcony", /balcony/i], ["porch", /porch/i], ["verandah", /verandah|veranda/i], ["terrace", /terrace/i], ["patio", /patio/i], ["entry", /entry|foyer/i], ["hallway", /hall/i], ["bathroom", /bath/i],
];
export const roomTypeForName = (name = "") => ROOM_TYPE_PATTERNS.find(([, pattern]) => pattern.test(String(name)))?.[0] || "";
const slug = (value = "") => String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function newTilingRoom({ type = "other", name = "", id = "" } = {}) {
  const roomType = tilingRoomType(type);
  return {
    id: id || `tiling-room-${slug(name || roomType.label)}-${Math.random().toString(36).slice(2, 8)}`,
    name: String(name || roomType.label).trim(),
    type: roomType.type,
    spec: "",
    // Linear dimensions are millimetres; floorAreaM2 (custom / irregular rooms) is an area.
    dimensionUnit: TILING_DIMENSION_UNIT,
    geometry: { mode: "rectangle", widthMm: "", lengthMm: "", ceilingHeightMm: "", floorAreaM2: "", perimeterMm: "", source: "manual" },
    components: {},
    openings: [],
    wastagePct: DEFAULT_TILE_WASTAGE_PCT,
    products: {},
    floorWastes: [],
  };
}

// Tiled rooms suggested from the project's own room names; never a fixed list of bathrooms.
// takeoff (tilingTakeoffData): external areas Job Setup / Takeoff measured (alfresco, patio,
// balcony, porch) are added with their measured floor area already filled in.
export function suggestedTilingRooms(projectRoomNames = [], takeoff = null) {
  const seen = new Set();
  const rooms = projectRoomNames
    .map((name) => String(name || "").trim())
    .filter((name) => name && roomTypeForName(name) && !seen.has(slug(name)) && seen.add(slug(name)))
    .map((name) => newTilingRoom({ type: roomTypeForName(name), name, id: `tiling-room-${slug(name)}` }));
  return [...rooms.map((room) => withTakeoffFloorArea(room, takeoff)), ...takeoffExternalRoomsToAdd(rooms, takeoff).map(tilingRoomFromTakeoff)];
}

// External tiled areas the job's Job Setup / Takeoff has an area for. Nothing is listed for an
// area the project does not have.
export const TAKEOFF_EXTERNAL_TYPES = Object.freeze(["alfresco", "patio", "balcony", "porch"]);
export function takeoffExternalRoomsToAdd(rooms = [], takeoff = null) {
  return TAKEOFF_EXTERNAL_TYPES
    .map((type) => ({ type, name: tilingRoomType(type).label, areaM2: Number(takeoff?.floorAreaByRoomType?.[type]) || 0 }))
    .filter((entry) => entry.areaM2 > 0 && !rooms.some((room) => room.type === entry.type));
}
export function tilingRoomFromTakeoff(entry = {}) {
  return withTakeoffFloorArea(newTilingRoom({ type: entry.type, name: entry.name, id: `tiling-room-${slug(entry.name)}` }), { floorAreaByRoomType: { [entry.type]: entry.areaM2 } });
}
// Pre-fills a room's floor area from the measured area for its type. Only an untouched room: an
// area or dimensions the builder entered are never replaced.
function withTakeoffFloorArea(room, takeoff) {
  const areaM2 = Number(takeoff?.floorAreaByRoomType?.[room.type]) || 0;
  const geometry = room.geometry || {};
  if (!areaM2 || geometry.floorAreaM2 || geometry.widthMm || geometry.lengthMm) return room;
  return { ...room, geometry: { ...geometry, mode: "custom", floorAreaM2: Math.round(areaM2 * 100) / 100, source: "takeoff" } };
}

// Add Room: refuses an exact duplicate name; a deliberately different name is always allowed.
export function addTilingRoom(rooms = [], { type, name }) {
  const roomName = String(name || tilingRoomType(type).label).trim();
  if (rooms.some((room) => slug(room.name) === slug(roomName))) return { rooms, error: `${roomName} already exists. Give the new room a different name (for example ${roomName} 2).` };
  return { rooms: [...rooms, newTilingRoom({ type, name: roomName })], error: "" };
}

// Saved Floor Wastes & Drains lines ("Ensuite Shower x1") become that room's floor wastes, and saved
// per-m² tile selections are kept on the tiling record as legacySelections - nothing is dropped.
export function migrateLegacyTiling(rooms = [], selections = new Map()) {
  let next = rooms.map((room) => ({ ...room, floorWastes: [...(room.floorWastes || [])] }));
  const wasteSelection = selections.get(LEGACY_FLOOR_WASTE_KEY);
  const lines = wasteSelection ? plumbingLinesFromSelection(wasteSelection.selected_details || wasteSelection) : [];
  for (const line of lines) {
    for (const allocation of line.allocations || []) {
      const application = plumbingAllocationApplication(allocation.location) || "Floor";
      const roomName = application ? String(allocation.location).replace(new RegExp(`\\s+${application}$`, "i"), "").trim() : allocation.location;
      let room = next.find((item) => slug(item.name) === slug(roomName));
      if (!room) { room = newTilingRoom({ type: roomTypeForName(roomName) || "other", name: roomName, id: `tiling-room-${slug(roomName)}` }); next = [...next, room]; }
      if (room.floorWastes.some((waste) => waste.productId === line.productId && waste.application === application)) continue;
      room.floorWastes.push({ productId: line.productId, productName: line.productName, application, quantity: allocation.quantity, unitPrice: line.unitPrice, linear: /channel|linear|strip/i.test(line.productName || ""), migratedFrom: LEGACY_FLOOR_WASTE_KEY });
    }
  }
  const legacySelections = LEGACY_TILE_REQUIREMENT_KEYS
    .map((key) => [key, selections.get(key)])
    .filter(([, selection]) => selection)
    .map(([key, selection]) => ({ requirementKey: key, productId: selection.selected_details?.productId || "", productName: selection.selected_product_name || selection.selected_details?.productName || "", selectedPrice: selection.selected_details?.selectedPrice ?? null }));
  return { rooms: next, legacySelections };
}

const priceOf = (product) => {
  const value = Number(product?.clientPrice ?? product?.rrp ?? product?.selectedCost);
  return Number.isFinite(value) && value > 0 ? value : null;
};

// The selection-book row patch for the whole tiling specification.
export function tilingSelectionPatch(requirement = {}, sourceRooms = [], { productById = () => null, legacySelections = [], previous = null, projectId = "", organisationId = "", now = new Date().toISOString() } = {}) {
  // Saved rooms are always in millimetres: a room loaded from an older job is converted here.
  const rooms = sourceRooms.map(tilingRoomInMm);
  const calculated = rooms.map((room) => ({ room, result: calculateTilingRoom(room, { productById }) }));
  let selectedTotal = 0;
  let unpriced = 0;
  for (const { result } of calculated) {
    for (const item of result.surfaces) {
      if (!item.product || !item.order) continue;
      const price = priceOf(item.product);
      if (price === null) unpriced += 1; else selectedTotal += price * item.order.orderAreaM2;
    }
    for (const waste of result.floorWastes) {
      const price = Number(waste.unitPrice);
      if (Number.isFinite(price) && price > 0) selectedTotal += price * Number(waste.quantity || 0); else unpriced += 1;
    }
  }
  selectedTotal = Math.round(selectedTotal * 100) / 100;
  const allowance = Number(requirement.defaultAllowance) || 0;
  const configured = calculated.filter(({ room, result }) => result.geometry.complete && (tilingRoomType(room.type).spec ? room.spec : true)).length;
  // Each room judged on the surfaces that apply to it; the category is complete when they all are.
  const statuses = rooms.map((room) => ({ roomId: room.id, roomName: room.name, ...tilingRoomStatus(room, { productById }) }));
  const completeRooms = statuses.filter((item) => item.status === "complete").length;
  const summary = `${completeRooms} of ${rooms.length} tiled room${rooms.length === 1 ? "" : "s"} complete: ${rooms.map((room) => room.name).join(", ")}`;
  return {
    selectedProduct: summary,
    description: summary,
    allowanceAmount: allowance,
    selectedCost: selectedTotal,
    upgradeCost: unpriced ? null : Math.round((selectedTotal - allowance) * 100) / 100,
    included: false,
    status: rooms.length ? "selected" : "pending",
    guidedSelection: rooms.length ? {
      source: "guided_client_selections",
      projectId,
      organisationId,
      area: requirement.areaKey,
      room: requirement.areaLabel,
      requirementKey: requirement.requirementKey,
      requirementLabel: requirement.label,
      productName: summary,
      selectedProduct: summary,
      unit: "ROOM",
      quantity: rooms.length,
      allowance,
      selectedPrice: selectedTotal,
      selectedTotal,
      variation: unpriced ? null : Math.round((selectedTotal - allowance) * 100) / 100,
      variationPending: unpriced > 0,
      priceState: unpriced ? "Price Pending" : "Current Price",
      tilingRooms: rooms,
      tilingDimensionUnit: TILING_DIMENSION_UNIT,
      // Each tile product consolidated across rooms, with every room's share (tilingProductTotals).
      tilingProductTotals: tilingProductTotals(rooms, { productById }).map((entry) => ({ ...entry, netAreaM2: Math.round(entry.netAreaM2 * 100) / 100, orderAreaM2: Math.round(entry.orderAreaM2 * 100) / 100, rooms: entry.rooms.map((room) => ({ roomId: room.roomId, roomName: room.roomName, orderAreaM2: Math.round(room.orderAreaM2 * 100) / 100 })) })),
      tilingConfiguredRooms: configured,
      tilingCompleteRooms: completeRooms,
      // The same counts split the way the screen shows them: full rooms and simple floor areas.
      tilingFloorAreas: rooms.filter(isFloorAreaRoom).length,
      tilingCompleteFloorAreas: statuses.filter((item, index) => item.status === "complete" && isFloorAreaRoom(rooms[index])).length,
      tilingRoomStatuses: statuses.map(({ roomId, roomName, status, missing }) => ({ roomId, roomName, status, missing })),
      tilingLegacySelections: legacySelections,
      selectedAt: previous?.selectedAt || now,
      updatedAt: now,
    } : null,
  };
}

// Quotation Builder: one section per room ("TILING - BATHROOM"), one line per surface and per
// floor waste, with the net area, wastage and order area kept; labour quantities as separate lines.
export const TILING_SELECTION_SOURCE = "client-selections-tiling-room";
const exGst = (price) => (price === null ? "" : Math.round((price / 1.1) * 10000) / 10000);
export function tilingQuotationEntries(rooms = [], { productById = () => null } = {}) {
  return rooms.flatMap((room) => {
    const result = calculateTilingRoom(room, { productById });
    const sectionName = `TILING - ${room.name.toUpperCase()}`;
    const materials = result.surfaces.filter((item) => item.areaM2).map((item) => ({
      sectionName, room, key: item.key,
      item: `${item.label}${item.product ? ` - ${item.product.brand} ${item.product.productName} ${item.product.sku || ""}`.trimEnd() : " - tile to be selected"} (${item.order.netAreaM2.toFixed(2)}m² + ${item.order.wastagePct}% = ${item.order.orderAreaM2.toFixed(2)}m²${item.order.boxes ? `, ${item.order.boxes} boxes` : ""})`,
      unit: "M2", quantity: Math.round(item.order.orderAreaM2 * 100) / 100, rate: item.product ? exGst(priceOf(item.product)) : "",
      productId: item.productId, productCode: item.product?.productCode || "", order: item.order,
    }));
    const wastes = result.floorWastes.map((waste) => {
      const product = productById(waste.productId);
      const price = Number(waste.unitPrice ?? priceOf(product));
      return { sectionName, room, key: `waste-${waste.productId}-${waste.application}`, item: `${waste.linear ? "Linear drain" : "Floor waste"} (${waste.application}) - ${waste.productName || product?.productName || ""}${waste.lengthMm ? ` ${waste.lengthMm}mm` : ""}`, unit: "EACH", quantity: Number(waste.quantity) || 0, rate: Number.isFinite(price) && price > 0 ? exGst(price) : "", productId: waste.productId, productCode: product?.productCode || "" };
    });
    const labourRows = [["floorM2", "Labour - floor tiling", "M2"], ["wallM2", "Labour - wall tiling", "M2"], ["featureM2", "Labour - feature tiling", "M2"], ["mosaicM2", "Labour - mosaic tiling", "M2"], ["splashbackM2", "Labour - splashback tiling", "M2"], ["skirtingLm", "Labour - skirting tiles", "LM"], ["floorWasteQty", "Labour - install floor wastes", "EACH"], ["linearDrainQty", "Labour - install linear drains", "EACH"]]
      .filter(([key]) => result.labour[key])
      .map(([key, item, unit]) => ({ sectionName, room, key: `labour-${key}`, item, unit, quantity: Math.round(result.labour[key] * 100) / 100, rate: "", labour: true }));
    return [...materials, ...wastes, ...labourRows];
  });
}

export function connectTilingSelectionsToQuotation(workbook = {}, book = {}, { productById = () => null } = {}) {
  const row = (book?.rooms || []).flatMap((room) => room.rows || []).find((entry) => entry?.guidedSelection?.requirementKey === TILING_REQUIREMENT_KEY);
  const rooms = row?.guidedSelection?.tilingRooms || [];
  const quotation = Object.fromEntries(Object.entries(workbook.quotation || {}).map(([name, section]) => [name, { ...section, rows: (section.rows || []).filter((item) => item.source !== TILING_SELECTION_SOURCE) }]));
  const previousRows = Object.values(workbook.quotation || {}).flatMap((section) => section.rows || []);
  const entries = tilingQuotationEntries(rooms, { productById });
  for (const entry of entries) {
    const id = `tiling:${entry.room.id}:${entry.key}`;
    const previous = previousRows.find((item) => item.id === id) || {};
    const section = quotation[entry.sectionName] || { collapsed: true, rows: [] };
    section.rows = [...(section.rows || []), {
      ...previous, id, source: TILING_SELECTION_SOURCE, section: entry.sectionName, item: entry.item, description: entry.item,
      unit: entry.unit, qty: entry.quantity, quantity: entry.quantity, excelRate: entry.rate, manualRate: previous.manualRate ?? "",
      productId: entry.productId || "", productCode: entry.productCode || "", tilingRoomId: entry.room.id, tilingRoomName: entry.room.name,
      tilingOrder: entry.order || null, lineType: "Standard rate item", active: true,
    }];
    quotation[entry.sectionName] = section;
  }
  for (const [name, section] of Object.entries(quotation)) if (/^TILING - /.test(name) && !section.rows.length) delete quotation[name];
  const procurement = workbook.procurement || {};
  const items = (procurement.items || []).filter((item) => item.source !== TILING_SELECTION_SOURCE);
  // The same tile in several rooms stays one line per room (the room allocation), and every line
  // carries the product's job total so the order can be placed as one quantity.
  const totals = new Map(tilingProductTotals(rooms, { productById }).map((entry) => [entry.productId, entry]));
  for (const entry of entries.filter((item) => !item.labour && item.productId)) {
    const total = entry.order ? totals.get(entry.productId) : null;
    items.push({
      ...(total ? { productTotalOrderAreaM2: Math.round(total.orderAreaM2 * 100) / 100, productTotalBoxes: total.boxes, productRooms: total.rooms.map((room) => ({ roomName: room.roomName, orderAreaM2: Math.round(room.orderAreaM2 * 100) / 100 })) } : {}),
      id: `tiling:${entry.room.id}:${entry.key}`, source: TILING_SELECTION_SOURCE, sectionName: entry.sectionName, itemDescription: entry.item,
      productId: entry.productId, productCode: entry.productCode, qty: entry.order?.boxes ?? entry.quantity, unit: entry.order?.boxes ? "BOX" : entry.unit,
      netAreaM2: entry.order?.netAreaM2 ?? null, wastagePct: entry.order?.wastagePct ?? null, orderAreaM2: entry.order?.orderAreaM2 ?? null,
      boxCoverageM2: entry.order?.boxCoverageM2 ?? null, suppliedAreaM2: entry.order?.suppliedAreaM2 ?? null, location: entry.room.name,
    });
  }
  return { ...workbook, quotation, procurement: { ...procurement, items } };
}

// ---------------------------------------------------------------------------------------------
// Tile schemes: copy one room's tile CHOICES to other rooms
// ---------------------------------------------------------------------------------------------
// A scheme is what was chosen, never what was measured: the product per surface slot, wastage,
// laying pattern / grout / trim, and the tile height rules (tiling specification, shower tile
// height, bath and vanity splashback heights). Applying it writes those values into each
// destination room's OWN records - a one-time copy with no link between the rooms afterwards - and
// never touches a destination's dimensions, components, openings or floor wastes, so its quantities
// are always recalculated from its own areas.

export const TILING_FINISH_FIELDS = Object.freeze([
  { key: "pattern", label: "Laying pattern" },
  { key: "grout", label: "Grout colour" },
  { key: "trim", label: "Trim / edging" },
]);
export const TILING_PATTERNS = Object.freeze(["Straight / stacked", "Brick bond (50%)", "Third bond (33%)", "Herringbone", "Diagonal (45°)", "Vertical stack"]);
const SLOT_LABEL = Object.fromEntries(TILING_SLOTS.map((item) => [item.slot, item.label]));
const filled = (value) => value !== "" && value !== null && value !== undefined;

// Whether a room holds any tile choice an applied scheme could replace.
export function roomHasTileScheme(room = {}) {
  return Object.values(room.products || {}).some(Boolean) || TILING_FINISH_FIELDS.some(({ key }) => filled(room.finish?.[key]));
}

// The surface slots a room actually has (a room with no feature wall has no feature slot).
export function roomTileSlots(room = {}) {
  const surfaces = calculateTilingRoom(room).surfaces;
  return TILING_SLOTS.map((item) => item.slot).filter((slot) => surfaces.some((surface) => surface.slot === slot || (slot === "splashback" && surface.key === "vanity-splashback")));
}

// Rooms a scheme can be offered to: the project's other wet areas. `recommended` marks the rooms of
// the same kind as the source (bathroom / ensuite / powder room) for "Select all relevant rooms".
export function tilingSchemeTargets(rooms = [], sourceId = "") {
  const source = rooms.find((room) => room.id === sourceId);
  const sourceType = tilingRoomType(source?.type);
  return rooms
    .filter((room) => room.id !== sourceId && tilingRoomType(room.type).wet && !tilingRoomType(room.type).external)
    .map((room) => ({ room, recommended: Boolean(tilingRoomType(room.type).spec) === Boolean(sourceType.spec), hasExisting: roomHasTileScheme(room) }));
}

// What applying `source` to `target` would do, without doing it.
export function tilingSchemePreview(sourceRoom = {}, targetRoom = {}, { mode = "replace" } = {}) {
  const source = tilingRoomInMm(sourceRoom);
  const target = tilingRoomInMm(targetRoom);
  const replaceAll = mode !== "fill-empty";
  const sourceType = tilingRoomType(source.type);
  const targetType = tilingRoomType(target.type);
  const components = target.components || {};
  // Tile height rules only where the destination has the thing they describe.
  const rules = {};
  const rule = (applies, current, value, write) => { if (applies && filled(value) && (replaceAll || !filled(current)) && value !== current) write(value); };
  rule(sourceType.spec && targetType.spec, target.spec, source.spec, (value) => { rules.spec = value; });
  rule(components.shower?.enabled, components.shower?.heightMm, source.components?.shower?.heightMm, (value) => { rules.showerHeightMm = value; });
  rule(components.bath?.enabled, components.bath?.splashbackHeightMm, source.components?.bath?.splashbackHeightMm, (value) => { rules.bathSplashbackHeightMm = value; });
  rule(components.vanity?.enabled, components.vanity?.splashback, source.components?.vanity?.splashback, (value) => { rules.vanitySplashback = value; });
  rule(components.vanity?.enabled, components.vanity?.customHeightMm, source.components?.vanity?.customHeightMm, (value) => { rules.vanityCustomHeightMm = value; });
  // Slots are those of the destination as it will be once the specification rule is applied.
  const slots = roomTileSlots(rules.spec ? { ...target, spec: rules.spec } : target);
  const products = [];
  const skipped = [];
  for (const [slot, productId] of Object.entries(source.products || {})) {
    if (!productId) continue;
    const label = SLOT_LABEL[slot] || slot;
    const existing = target.products?.[slot] || "";
    if (!slots.includes(slot)) skipped.push({ slot, label, reason: `${target.name} has no ${label.toLowerCase().replace(/ tile$/, "")} surface` });
    else if (existing && !replaceAll) skipped.push({ slot, label, reason: "already chosen - kept", kept: true });
    else products.push({ slot, label, productId, replaces: existing && existing !== productId ? existing : "" });
  }
  const finish = TILING_FINISH_FIELDS
    .filter(({ key }) => filled(source.finish?.[key]) && (replaceAll || !filled(target.finish?.[key])))
    .map(({ key, label }) => ({ key, label, value: source.finish[key], replaces: filled(target.finish?.[key]) && target.finish[key] !== source.finish[key] ? target.finish[key] : "" }));
  const wastage = filled(source.wastagePct) && (replaceAll || !roomHasTileScheme(target)) ? source.wastagePct : null;
  return {
    targetId: target.id,
    targetName: target.name,
    hasExisting: roomHasTileScheme(target),
    products,
    skipped,
    finish,
    rules,
    wastagePct: wastage,
    replaces: [...products.filter((item) => item.replaces).map((item) => item.label), ...finish.filter((item) => item.replaces).map((item) => item.label)],
  };
}

// Returns the destination room with the scheme applied. mode "replace" overwrites its tile choices;
// "fill-empty" only fills what it has not chosen. Dimensions and components are carried over as is.
export function applyTilingScheme(sourceRoom = {}, targetRoom = {}, { mode = "replace", now = new Date().toISOString() } = {}) {
  const target = tilingRoomInMm(targetRoom);
  const preview = tilingSchemePreview(sourceRoom, target, { mode });
  const components = { ...(target.components || {}) };
  if ("showerHeightMm" in preview.rules) components.shower = { ...components.shower, heightMm: preview.rules.showerHeightMm };
  if ("bathSplashbackHeightMm" in preview.rules) components.bath = { ...components.bath, splashbackHeightMm: preview.rules.bathSplashbackHeightMm };
  if ("vanitySplashback" in preview.rules || "vanityCustomHeightMm" in preview.rules) {
    components.vanity = { ...components.vanity, ...("vanitySplashback" in preview.rules ? { splashback: preview.rules.vanitySplashback } : {}), ...("vanityCustomHeightMm" in preview.rules ? { customHeightMm: preview.rules.vanityCustomHeightMm } : {}) };
  }
  return {
    ...target,
    ...(preview.rules.spec ? { spec: preview.rules.spec } : {}),
    components,
    products: { ...(target.products || {}), ...Object.fromEntries(preview.products.map((item) => [item.slot, item.productId])) },
    finish: { ...(target.finish || {}), ...Object.fromEntries(preview.finish.map((item) => [item.key, item.value])) },
    ...(preview.wastagePct === null ? {} : { wastagePct: preview.wastagePct }),
    schemeDefault: false,
    // Audit only: nothing reads this to keep the rooms in step.
    schemeCopy: { copiedFromRoomId: sourceRoom.id, copiedFromRoomName: sourceRoom.name, copiedAt: now, mode, slots: preview.products.map((item) => item.slot), skipped: preview.skipped.filter((item) => !item.kept).map((item) => item.slot) },
  };
}

// "Use as bathroom default": one room at a time is the starting scheme offered to other wet rooms.
export function setTilingSchemeDefault(rooms = [], roomId = "") {
  return rooms.map((room) => (room.id === roomId ? { ...room, schemeDefault: true } : room.schemeDefault ? { ...room, schemeDefault: false } : room));
}
export const tilingSchemeDefaultRoom = (rooms = []) => rooms.find((room) => room.schemeDefault && roomHasTileScheme(room)) || null;

// Every tile product across the job: order area per room and surface, and the total - what the
// order is consolidated to, while each room's share stays visible.
export function tilingProductTotals(rooms = [], { productById = () => null } = {}) {
  const byProduct = new Map();
  for (const room of rooms) {
    for (const item of calculateTilingRoom(room, { productById }).surfaces) {
      if (!item.product || !item.order || !item.areaM2) continue;
      if (!byProduct.has(item.productId)) byProduct.set(item.productId, { productId: item.productId, productCode: item.product.productCode || "", productName: `${item.product.brand || ""} ${item.product.productName || ""}`.trim(), sku: item.product.sku || "", boxCoverageM2: Number(item.product.attributes?.boxCoverageM2) || null, rooms: [], netAreaM2: 0, orderAreaM2: 0 });
      const entry = byProduct.get(item.productId);
      let line = entry.rooms.find((value) => value.roomId === room.id);
      if (!line) { line = { roomId: room.id, roomName: room.name, surfaces: [], netAreaM2: 0, orderAreaM2: 0 }; entry.rooms.push(line); }
      line.surfaces.push({ key: item.key, label: item.label, orderAreaM2: item.order.orderAreaM2 });
      line.netAreaM2 += item.order.netAreaM2; line.orderAreaM2 += item.order.orderAreaM2;
      entry.netAreaM2 += item.order.netAreaM2; entry.orderAreaM2 += item.order.orderAreaM2;
    }
  }
  return [...byProduct.values()].map((entry) => ({ ...entry, boxes: entry.boxCoverageM2 ? Math.ceil(entry.orderAreaM2 / entry.boxCoverageM2 - 1e-9) : null }));
}

// ---------------------------------------------------------------------------------------------
// Additional Floor Tiling: simple floor-only areas
// ---------------------------------------------------------------------------------------------
// A floor area is the same record as a room (so it is saved, quoted, ordered and counted the same
// way) holding only a name, an area in m2 (or width x length in mm), a floor tile and a wastage.

// The floor-only area type a name suggests ("Front Porch" -> porch); anything else is "other".
export function floorAreaTypeForName(name = "") {
  const type = roomTypeForName(name);
  return type && tilingRoomType(type).floorOnly ? type : "other";
}

export function newFloorArea(rooms = [], { name = "", areaM2 = "", external } = {}) {
  let label = String(name || "").trim();
  if (!label) { let number = rooms.filter(isFloorAreaRoom).length + 1; do { label = `Floor area ${number}`; number += 1; } while (rooms.some((room) => slug(room.name) === slug(label))); }
  const room = newTilingRoom({ type: floorAreaTypeForName(label), name: label });
  return { ...room, geometry: { ...room.geometry, mode: "custom", floorAreaM2: areaM2 }, ...(typeof external === "boolean" ? { external } : {}) };
}

// Renaming a row keeps its type in step with its name until the builder sets External themselves.
export function renameFloorArea(room = {}, name = "") {
  return { ...room, name, type: floorAreaTypeForName(name) };
}

// APPLY TILE TO OTHER FLOOR AREAS: the tile, laying finish and wastage - never the area. Each row
// keeps its own area and recalculates its own quantity; the rows are not linked afterwards.
export function applyFloorTile(source = {}, target = {}, { now = new Date().toISOString() } = {}) {
  return {
    ...target,
    products: { ...(target.products || {}), floor: source.products?.floor || "" },
    ...(source.finish ? { finish: { ...(target.finish || {}), ...source.finish } } : {}),
    wastagePct: source.wastagePct ?? target.wastagePct,
    schemeCopy: { copiedFromRoomId: source.id, copiedFromRoomName: source.name, copiedAt: now, mode: "replace", slots: ["floor"], skipped: [] },
  };
}
export { isFloorAreaRoom };

export { TILING_ROOM_TYPES };
