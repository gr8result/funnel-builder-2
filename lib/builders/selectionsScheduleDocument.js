// Inclusions & Selections Schedule: the client's final selection / specification schedule.
//
// ONE document with THREE body sections only:
//   1. EXTERIOR SELECTIONS   2. INTERIOR SELECTIONS   3. PAINTING SCHEDULE
// Categories are compact subheadings inside a section, never pages of their own. Rows flow
// continuously and a new page starts only when the landscape A4 page is full.
//
// What belongs where:
//   product / factory finish (COLORBOND roof, garage door colour, window frame) -> its product row
//   paint applied on site (render, eaves, surrounds, walls, trims, ceilings)     -> Painting Schedule
// Detailed quantities (every window, every power point by room, ordering) stay in the Quotation
// Builder, BOQ and Procurement; this schedule says WHAT was selected.
//
// A selection is a Client Selections record (a row's guidedSelection). The legacy Selections Book
// template rows ("Westinghouse 600mm Oven", "Caroma Cube Basin", "... Included Selection") are
// placeholders the template seeds every job with; they are not selections and never appear.
//
// Every selection ends in exactly one place, and the reconciliation proves it: each source record
// is either rendered as its own row or consolidated into a named row. Nothing disappears.

import { CLIENT_SELECTION_CATEGORIES, clientSelectionCategoryForRequirement } from "./clientSelectionCategories.js";
import { electricalScheduleLines } from "./electricalSchedule.js";
import { internalPaintScheduleLines, normaliseInternalPaintScheme, choiceSwatch } from "./internalPaintColours.js";
import { applyIslandInheritance } from "./benchtopInheritance.js";
import { plumbingLocationKey } from "./plumbingFixtureAllocation.js";

export const SCHEDULE_SECTIONS = [
  { key: "exterior", number: 1, title: "Exterior Selections" },
  { key: "interior", number: 2, title: "Interior Selections" },
  { key: "painting", number: 3, title: "Painting Schedule" },
];
export const SCHEDULE_STATUS = { included: "Included", selected: "Selected", upgrade: "Upgrade", tbc: "TBC" };

// Exterior reads envelope first, then openings, then everything fixed to or around the house.
const EXTERIOR_GROUPS = [
  { key: "exterior-envelope", title: "Exterior Envelope", categories: ["roofing", "external-cladding"] },
  { key: "entry-doors", title: "Entry Doors & Hardware", categories: ["external-doors"] },
  { key: "windows", title: "Windows", categories: ["windows-glazing"] },
  { key: "garage-door", title: "Garage Door", categories: ["garage-doors"] },
  { key: "external-lighting", title: "External Lighting", categories: ["external-lighting"] },
  { key: "outdoor-living", title: "Outdoor Living", categories: ["outdoor-living"] },
  { key: "external-balustrades", title: "External Balustrades", categories: ["balustrades"] },
  { key: "external-accessories", title: "External Accessories", categories: ["external-accessories"] },
  { key: "driveway-landscaping", title: "Driveway & Landscaping", categories: ["landscaping-optional"] },
  { key: "solar-batteries", title: "Solar, Batteries & EV Charging", categories: ["solar-batteries"] },
];
// Interior follows the Client Selections order, with floor coverings last and paint in Section 3.
const INTERIOR_GROUPS = [
  ...CLIENT_SELECTION_CATEGORIES.filter((item) => item.sides.includes("interior") && !["flooring", "paint-wall-finishes"].includes(item.key)).map((item) => ({ key: item.key, title: item.label, categories: [item.key] })),
  { key: "flooring", title: "Flooring & Carpet", categories: ["flooring"] },
];
const PAINTING_GROUPS = [
  { key: "exterior-painting", title: "Exterior Painting" },
  { key: "interior-house", title: "Interior Painting - House Default" },
  { key: "interior-feature", title: "Interior Painting - Feature Walls" },
  { key: "interior-rooms", title: "Interior Painting - Room Overrides" },
];
const GROUPS = { exterior: [...EXTERIOR_GROUPS, { key: "other-exterior", title: "Other Exterior Selections", categories: [] }], interior: [...INTERIOR_GROUPS, { key: "other-interior", title: "Other Interior Selections", categories: [] }], painting: PAINTING_GROUPS };

// ---- Human-readable formatters -------------------------------------------------------------------
// Nothing reaches the document without passing through text(): an object or array is turned into
// the words it stands for, never "[object Object]" or a JSON blob.
const NAME_KEYS = ["label", "name", "productName", "roomOrExteriorArea", "exactLocation", "location", "room", "areaName", "colourName", "officialName", "title", "value"];
export function text(value) {
  if (value == null || value === false) return "";
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (Array.isArray(value)) return unique(value.map(text)).join(", ");
  if (typeof value === "object") { for (const key of NAME_KEYS) { const found = text(value[key]); if (found) return found; } return ""; }
  return "";
}
const unique = (list) => { const seen = new Set(); return list.filter((item) => item && !seen.has(item.toLowerCase()) && seen.add(item.toLowerCase())); };
const join = (parts, separator = " / ") => unique(parts.map(text)).join(separator);
const NOT_A_VALUE = /^(not specified( by supplier)?|n\/a|na|none|not applicable.*|builder selected.*|supplier confirmation required|manufacturer colour|-+)$/i;
const meaningful = (value) => { const found = text(value); return NOT_A_VALUE.test(found) ? "" : found; };
const number = (value) => (value === "" || value == null || !Number.isFinite(Number(value)) ? null : Number(value));
const round = (value) => Math.round(value * 100) / 100;
const UNITS = { each: "", ea: "", m2: "m²", "m²": "m²", sqm: "m²", lm: "lm", length: "lengths", set: "set", room: "rooms" };
export function formatQuantity(quantity, unit = "") {
  const amount = number(quantity);
  if (amount == null || amount === 0) return "";
  const key = text(unit).toLowerCase();
  const suffix = key in UNITS ? UNITS[key] : /door|location/.test(key) ? "" : text(unit);
  return `${round(amount)}${suffix ? (suffix === "m²" ? "m²" : ` ${suffix}`) : ""}`;
}
// "Main Bathroom, Ensuite x2, Bed 2 Ensuite" - where each unit goes, with a count where it is not one.
export function formatLocations(allocations = [], unit = "") {
  const totals = new Map();
  for (const item of Array.isArray(allocations) ? allocations : []) {
    const name = titleRoom(typeof item === "string" ? item : text(item?.location || item?.roomOrExteriorArea || item?.roomName || item?.name || item?.room || item?.exactLocation));
    if (!name) continue;
    const quantity = typeof item === "string" ? 1 : number(item.quantity ?? item.qty) ?? 1;
    const key = plumbingLocationKey(name);
    const entry = totals.get(key) || { name, quantity: 0 };
    entry.quantity = round(entry.quantity + quantity);
    totals.set(key, entry);
  }
  const measured = /m2|m²|lm/i.test(text(unit));
  return [...totals.values()].map(({ name, quantity }) => (measured ? `${name} ${formatQuantity(quantity, unit)}` : quantity === 1 ? name : `${name} ×${quantity}`)).join(", ");
}
// Room names are stored in several casings ("BED 2 ENSUITE", "2nd BEDROOM ENSUITE"); print one.
function titleRoom(value) {
  const name = text(value);
  if (/^unallocated$/i.test(name)) return "Location to be confirmed";
  return /\b[A-Z]{4,}\b/.test(name) ? name.toLowerCase().replace(/(^|\s)[a-z]/g, (letter) => letter.toUpperCase()) : name;
}
const titleCase = (value) => text(value).replace(/[-_]+/g, " ").replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
const PLACEHOLDER_IMAGE = /placeholder|missing|example|images\.unsplash\.com/i;
const image = (...candidates) => candidates.map((value) => (typeof value === "string" ? value.trim() : "")).find((value) => value && !PLACEHOLDER_IMAGE.test(value)) || "";
const hex = (value) => (/^#[0-9a-f]{3,8}$/i.test(text(value)) ? text(value) : "");

// Included / Selected / Upgrade / TBC. No prices: the quotation deals with cost.
function statusOf(guided = {}, line = {}) {
  if (!text(line.productName || guided.productName || guided.selectedProduct)) return SCHEDULE_STATUS.tbc;
  const flag = `${text(line.includedStatus)} ${text(guided.includedStatus)}`.toLowerCase();
  const variation = number(line.variation ?? guided.variationAmount ?? guided.variation);
  if (/upgrade/.test(flag) || (variation != null && variation > 0)) return SCHEDULE_STATUS.upgrade;
  if (/included|standard/.test(flag) || guided.isIncludedSelection === true || guided.builderStandard === true) return SCHEDULE_STATUS.included;
  return SCHEDULE_STATUS.selected;
}

// ---- Rows ------------------------------------------------------------------------------------------
// One printed line: { id, section, group, item, product, details, brandSupplier, modelCode,
// colourFinish, swatch, qtyLocation, status, imageUrl, sourceRowId }.
function makeRow(context, fields) {
  const clean = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, key === "imageUrl" ? image(value) : key === "swatch" ? hex(value) : text(value)]));
  return { item: "", product: "", details: "", brandSupplier: "", modelCode: "", colourFinish: "", swatch: "", qtyLocation: "", status: SCHEDULE_STATUS.selected, imageUrl: "", ...clean,
    id: `${context.sourceKey}:${fields.id || context.rows.length}`, section: fields.section || context.section, group: fields.group || context.group, sourceRowId: context.rowId, requirementKey: context.requirementKey };
}
function sectionAndGroup(requirementKey, guided = {}) {
  const side = /exterior|external/i.test(text(guided.area)) ? "exterior" : /interior|internal/i.test(text(guided.area)) ? "interior" : "";
  const category = clientSelectionCategoryForRequirement(requirementKey, side);
  const section = category ? (side && category.sides.includes(side) ? side : category.sides[0]) : side || "interior";
  const group = GROUPS[section].find((item) => category && item.categories?.includes(category.key));
  return { section, group: group?.key || `other-${section}` };
}

// A selection made of product lines with a quantity and where each unit goes (plumbing fixtures,
// accessories, screens, mirrors, lighting, fans, hot water, balustrades). Lines for the same product
// and finish are one row.
function allocationRows(context, guided) {
  const merged = new Map();
  for (const line of guided.plumbingAllocation.lines || []) {
    const key = [line.productCode || line.productId || line.productName, line.finish || line.colour].map(text).join("|").toLowerCase();
    const entry = merged.get(key) || { line, quantity: 0, allocations: [], lineIds: [] };
    entry.quantity += number(line.quantity) ?? (line.allocations || []).reduce((total, item) => total + (number(item.quantity) || 0), 0);
    entry.allocations.push(...(line.allocations || []));
    entry.lineIds.push(text(line.lineId || line.productId || line.productName));
    merged.set(key, entry);
  }
  return [...merged.values()].map(({ line, quantity, allocations, lineIds }) => {
    const unit = line.unit || guided.unit;
    const configuration = line.configuration && typeof line.configuration === "object" ? unique([line.configuration.screenType, line.configuration.configuration, line.configuration.glass ? `${text(line.configuration.glass)} glass` : ""].map(text))
      .filter((part) => !text(line.productName).toLowerCase().includes(part.toLowerCase())).join(", ") : "";
    const row = makeRow(context, { id: lineIds[0], item: context.label, product: line.productName, details: configuration, brandSupplier: join([line.brand, line.supplier]), modelCode: join([line.model || line.supplierCode, line.sku]),
      colourFinish: join([meaningful(line.colour), meaningful(line.finish)]), qtyLocation: join([formatQuantity(quantity, unit) && `Qty ${formatQuantity(quantity, unit)}`, formatLocations(allocations, unit)], " - "),
      status: statusOf(guided, line), imageUrl: image(line.imageUrl, line.product?.imageUrl) });
    lineIds.forEach((id) => context.source(`${context.label}: ${text(line.productName)}${lineIds.length > 1 ? ` (${id})` : ""}`, row));
    return row;
  });
}

const measuredUnit = (unit) => /m2|m²|sqm|lm/i.test(text(unit));
const meaningfulQuantity = (quantity, unit) => ((number(quantity) || 0) > 1 || measuredUnit(unit) ? formatQuantity(quantity, measuredUnit(unit) ? unit : "") : "");
const place = (value) => { const found = meaningful(value); return /^(exterior|interior|internal|external|project|general)$/i.test(found) ? "" : titleRoom(found); };
function genericRow(context, guided, row) {
  const product = text(guided.productName || guided.selectedProduct || row.selectedProduct);
  const unit = guided.unit;
  const made = makeRow(context, { item: context.label, product: product || "Selection outstanding", brandSupplier: join([meaningful(guided.brand), meaningful(guided.supplierName || guided.supplier)]),
    modelCode: join([guided.model, guided.sku]), colourFinish: join([meaningful(guided.officialColourName || guided.colour), meaningful(guided.finish || guided.specs?.finish)]),
    qtyLocation: join([meaningfulQuantity(guided.quantity, unit), guided.locationAllocations?.length ? formatLocations(guided.locationAllocations, unit) : place(guided.areaLabel || guided.room)], " - "),
    swatch: guided.swatchHex, status: statusOf(guided), imageUrl: image(guided.exactImageUrl, guided.selectedProductImageUrl, guided.officialSampleImage, guided.imageReference, guided.imageUrl) });
  context.source(`${context.label}: ${product || "outstanding"}`, made);
  return [made];
}

const HANDLERS = {
  // Roof, fascia, gutters and downpipes: each with its own factory colour in its own row.
  roofing(context, guided) {
    const configuration = guided.roofingConfiguration || {};
    const pack = guided.roofPackage || configuration.roofPackage || {};
    const rows = [];
    const brand = join([meaningful(guided.brand)]);
    const roofCode = text(configuration.profileProductCode || configuration.tileProductCode);
    const roofProduct = text(guided.roofProduct?.productName || configuration.profileName || context.lookup("", roofCode).productName || configuration.tileRange) || titleCase(roofCode.replace(/^ROOFING-/i, "").toLowerCase());
    if (roofProduct) rows.push(makeRow(context, { id: "roof", item: "Roof", product: roofProduct, brandSupplier: brand, colourFinish: join([meaningful(configuration.colour), meaningful(configuration.finish)], ", "),
      status: statusOf({ ...guided, productName: roofProduct }), imageUrl: image(context.lookup("", roofCode).imageUrl, guided.imageReference, guided.imageUrl) }));
    for (const [key, label] of [["fascia", "Fascia"], ["gutters", "Gutters"], ["downpipes", "Downpipes"]]) {
      const part = pack[key];
      if (!part || !text(part.productName || part.profile)) continue;
      rows.push(makeRow(context, { id: key, item: label, product: part.productName || part.profile, brandSupplier: key === "downpipes" ? "" : brand, colourFinish: meaningful(part.colour), status: statusOf(guided, part), imageUrl: image(context.lookup("", part.productCode).imageUrl) }));
    }
    if (!rows.length) return genericRow(context, guided, {});
    rows.forEach((row) => context.source(`Roofing: ${row.item}`, row));
    return rows;
  },
  // The entry door with its glass in one line; its lock set is the one further line worth its own.
  "entry-door"(context, guided) {
    const doors = Array.isArray(guided.entryDoors) && guided.entryDoors.length ? guided.entryDoors : [guided];
    return doors.flatMap((door, index) => {
      const glass = door.glassSelection || {};
      const furniture = door.entryDoorFurniture || {};
      const where = join([door.door?.doorReference, door.door?.level, door.door?.location], ", ");
      const hasGlass = Boolean(text(glass.name || door.glazing));
      const main = makeRow(context, { id: `door-${index}`, item: hasGlass ? "Entry Door & Glass" : "Entry Door", product: door.productName || door.selectedProduct, details: join([meaningful(door.size), meaningful(door.configuration), hasGlass && `Glass: ${text(glass.name || door.glazing)}`], " · "),
        brandSupplier: join([meaningful(door.brand), meaningful(door.supplier)]), modelCode: join([door.model]), colourFinish: join([meaningful(door.colour), meaningful(door.finish)]),
        qtyLocation: join([formatQuantity(door.door?.quantity || door.quantity || 1), where], " - "), status: statusOf(door), imageUrl: image(door.imageReference, door.imageUrl) });
      context.source(`Entry door: ${text(door.productName)}`, main);
      if (hasGlass) context.source(`Entry door glass: ${text(glass.name || door.glazing)}`, main, "shown in the entry door row");
      if (!text(furniture.productName)) return [main];
      const hardware = makeRow(context, { id: `hardware-${index}`, item: "Entry Door Hardware", product: furniture.productName, brandSupplier: join([furniture.brand, furniture.supplier]), modelCode: join([furniture.model || furniture.manufacturerSku]),
        colourFinish: join([door.furnitureFinish, furniture.lockingType], ", "), qtyLocation: join([formatQuantity(door.hardwareOptions?.quantity || door.door?.quantity || 1), where], " - "), status: statusOf(door, furniture), imageUrl: image(furniture.imageUrl) });
      context.source(`Entry door hardware: ${text(furniture.productName)}`, hardware);
      return [main, hardware];
    });
  },
  // What the client selected for the windows - never every window. Windows that share a system,
  // frame colour, glass, screen and hardware are one line; a different glass is its own line.
  windows(context, guided) {
    const workflow = guided.windowWorkflow || {};
    const defaults = workflow.projectDefaults || {};
    const windows = Array.isArray(workflow.effectiveWindows) ? workflow.effectiveWindows : [];
    if (!windows.length) return genericRow(context, guided, {});
    const groups = new Map();
    for (const item of windows) {
      const spec = { system: text(item.system?.name || guided.range), colour: text(item.frameColourName || defaults.frameColourName), finish: text(item.frameColourFinish || defaults.frameColourFinish), code: text(item.frameColourCode || defaults.frameColourCode),
        swatch: item.frameColourHex || defaults.frameColourHex, glass: text(item.glass || defaults.glassName), screen: text(item.screen || defaults.screens), hardware: text(item.hardware || defaults.hardware), supplier: text(item.supplier || guided.supplier) };
      const key = [spec.system, spec.colour, spec.finish, spec.glass, spec.screen, spec.hardware].join("|").toLowerCase();
      const entry = groups.get(key) || { spec, count: 0, ids: [] };
      entry.count += number(item.quantity) || 1; entry.ids.push(text(item.windowCode || item.id));
      groups.set(key, entry);
    }
    const list = [...groups.values()].sort((left, right) => right.count - left.count);
    const defaultGlass = list[0].spec.glass;
    return list.map(({ spec, count, ids }, index) => {
      const row = makeRow(context, { id: `spec-${index}`, item: list.length > 1 && spec.glass !== defaultGlass ? `Windows - ${spec.glass}` : "Windows", product: spec.system || "Window system",
        details: join([spec.glass && `Glass: ${spec.glass}`, meaningful(spec.screen) && `Screens: ${spec.screen}`, spec.hardware && `Hardware: ${spec.hardware}`], " · "), brandSupplier: join([meaningful(guided.brand), spec.supplier]),
        colourFinish: join([spec.colour && `Frame: ${spec.colour}`, spec.finish, meaningful(spec.code)], ", "), swatch: spec.swatch, qtyLocation: `${count} window${count === 1 ? "" : "s"}`, status: statusOf(guided), imageUrl: image(guided.imageReference, guided.imageUrl) });
      ids.forEach((id, position) => context.source(`Window ${id || position + 1}`, row, "shares this window specification"));
      return row;
    });
  },
  "external-lighting"(context, guided) {
    const selection = guided.externalLightingSelection || {};
    const lines = selection.scheduleLines || selection.lines || guided.lightingSchedule || [];
    if (!lines.length) return genericRow(context, guided, {});
    return lines.map((line, index) => {
      const row = makeRow(context, { id: line.scheduleLineId || line.lineId || index, item: meaningful(line.category) || "External Light", product: line.productName || line.product?.productName, brandSupplier: join([line.brand || line.product?.brand, line.supplier || line.product?.supplier]),
        modelCode: join([line.model, line.sku]), colourFinish: join([meaningful(line.finish), meaningful(line.colour)]), qtyLocation: join([formatQuantity(line.quantity || 1) && `Qty ${formatQuantity(line.quantity || 1)}`, formatLocations(line.locations)], " - "),
        status: statusOf(guided, line), imageUrl: image(line.imageUrl, line.product?.imageUrl) });
      context.source(`External light: ${text(line.productName)}`, row);
      return row;
    });
  },
  // Colour by exterior area. A factory-finished component (roof, fascia, gutters, downpipes) already
  // carries its colour on its product row, so its colour line is not repeated. Everything painted on
  // site is a Painting Schedule line.
  "exterior-paint"(context, guided) {
    const areas = guided.clientColourSchedule?.length ? guided.clientColourSchedule : (guided.exteriorColourSelection?.areas || []).filter((area) => area.applicable !== false);
    const rows = [];
    for (const area of areas) {
      const colour = area.colourSelection || area.colour || {};
      const name = text(area.colourName || colour.officialName || colour.colourName || colour.name);
      const label = `Exterior colour: ${text(area.areaName)}${name ? ` - ${name}` : ""}`;
      const product = context.productRowFor(text(area.areaId));
      if (product) { context.source(label, product, `colour shown on the ${product.item} row`); continue; }
      const painted = !/factory/i.test(text(area.finishType));
      const supplier = join([meaningful(colour.manufacturer || colour.brand), meaningful(area.supplier || colour.supplier)]);
      const code = meaningful(area.colourCode || colour.code || colour.supplierCode);
      const swatch = area.swatch || area.hex || colour.hex || colour.swatch;
      const row = painted
        ? makeRow(context, { id: area.areaId || rows.length, section: "painting", group: "exterior-painting", item: area.areaName, product: name || "Colour outstanding", brandSupplier: supplier, modelCode: code,
          colourFinish: join([meaningful(area.material), titleCase(area.finishType)], ", "), swatch, status: name ? SCHEDULE_STATUS.selected : SCHEDULE_STATUS.tbc })
        : makeRow(context, { id: area.areaId || rows.length, section: "exterior", group: "exterior-envelope", item: area.areaName, product: meaningful(area.material) || text(area.areaName), brandSupplier: supplier, modelCode: code,
          colourFinish: name || "Colour outstanding", swatch, status: name ? SCHEDULE_STATUS.selected : SCHEDULE_STATUS.tbc });
      context.source(label, row);
      rows.push(row);
    }
    return rows;
  },
  // House default once, then feature walls, then only the rooms that differ.
  "interior-paint"(context, guided) {
    const scheme = normaliseInternalPaintScheme(guided.paintScheme);
    const groupFor = { house: "interior-house", feature: "interior-feature", override: "interior-rooms" };
    return internalPaintScheduleLines(scheme).map((line) => {
      const choice = line.choice;
      const row = makeRow(context, { id: line.id, section: "painting", group: groupFor[line.kind] || "interior-house", item: line.label, product: choice ? join([choice.manufacturer, choice.colourName], " ") : "Colour outstanding", modelCode: choice?.colourCode,
        colourFinish: choice?.finish, swatch: choiceSwatch(choice), qtyLocation: line.kind === "house" ? "Throughout" : join([line.location, line.notes], " - "), status: choice ? (choice.standard ? SCHEDULE_STATUS.included : SCHEDULE_STATUS.selected) : SCHEDULE_STATUS.tbc });
      context.source(`Interior paint: ${text(line.label)}`, row);
      return row;
    });
  },
  // How many of each point the house has; the room-by-room count stays with the estimate.
  "electrical-schedule"(context, guided) {
    const points = new Map();
    for (const line of electricalScheduleLines(guided.electricalSchedule || { rooms: [] })) {
      if (!(line.selectedQty > 0)) continue;
      const entry = points.get(line.label) || { quantity: 0, rooms: [], lines: [] };
      entry.quantity += line.selectedQty; entry.rooms.push({ location: line.room, quantity: line.selectedQty }); entry.lines.push(line);
      points.set(line.label, entry);
    }
    return [...points].map(([label, entry], index) => {
      const row = makeRow(context, { id: `point-${index}`, item: "Electrical Point", product: label, qtyLocation: join([`Qty ${entry.quantity}`, formatLocations(entry.rooms)], " - "), status: SCHEDULE_STATUS.selected });
      entry.lines.forEach((line) => context.source(`Electrical: ${text(line.room)} ${text(line.label)} ×${line.selectedQty}`, row, "counted in this point's total"));
      return row;
    });
  },
  cabinetry(context, guided) {
    const selection = guided.cabinetrySelection || {};
    const schedule = Array.isArray(selection.schedule) ? selection.schedule : [];
    const rows = [];
    for (const location of selection.locations || []) {
      if (location.included === false) continue;
      const name = text(location.location || location.name);
      const units = schedule.filter((line) => text(line.location) === name).reduce((total, line) => total + (number(line.quantity) || 0), 0);
      const main = location.areaSelections?.lowerDoorsDrawers || location.defaultColour || {};
      const areas = Array.isArray(location.benchtopAreas) ? applyIslandInheritance(location.benchtopAreas) : [];
      const tops = (areas.length ? areas.map((area) => area.surface) : [location.benchtop, ...Object.values(location.bathroomBenchtops || {})]).filter((surface) => surface && typeof surface === "object");
      const topName = (surface) => join([surface.supplier, surface.colourName || surface.colour || surface.productName || surface.range || surface.materialChoice], " ");
      // One benchtop shows its surface; benchtops that differ are each named, so the schedule reflects the actual selection per benchtop.
      const differing = unique(areas.filter((area) => area.surface).map((area) => topName(area.surface))).length > 1;
      const benchtops = differing ? areas.filter((area) => area.surface).map((area) => `${text(area.label)} - ${topName(area.surface)}`) : unique(tops.map(topName));
      const handle = location.handles?.base || {};
      if (!units && !text(main.colourName) && !benchtops.length) continue;
      const row = makeRow(context, { id: name, item: name, product: join([meaningful(location.doorMaterialGroup), "cabinetry"], " "), details: join([benchtops.length ? `Benchtop: ${benchtops.join("; ")}` : "", text(handle.productName) ? `Handles: ${join([handle.productName, handle.selectedFinish], " ")}` : ""], " · "),
        brandSupplier: meaningful(main.supplier || location.supplier), modelCode: /^[a-z]+(-[a-z]+)+$/.test(text(main.colourCode)) ? "" : main.colourCode, colourFinish: join([main.colourName, main.finish], ", "), swatch: main.hex || main.swatchHex,
        qtyLocation: units ? `${units} cabinet${units === 1 ? "" : "s"}` : "", status: text(main.colourName) ? SCHEDULE_STATUS.selected : SCHEDULE_STATUS.tbc, imageUrl: image(main.swatchImage) });
      context.source(`Cabinetry: ${name}`, row);
      benchtops.forEach((top) => context.source(`Benchtop: ${name} - ${top}`, row, "shown in the cabinetry row"));
      rows.push(row);
    }
    return rows;
  },
  // One line per tile, with the rooms it goes in.
  "tiling-rooms"(context, guided) {
    const totals = Array.isArray(guided.tilingProductTotals) ? guided.tilingProductTotals : [];
    if (!totals.length) return genericRow(context, guided, {});
    return totals.map((tile, index) => {
      const found = context.lookup(tile.productId, tile.productCode);
      const row = makeRow(context, { id: tile.productId || index, item: "Tiles", product: tile.productName, brandSupplier: join([found.brand, found.supplier]), modelCode: tile.sku, colourFinish: join([meaningful(found.colour), meaningful(found.finish)]),
        qtyLocation: join([formatQuantity(tile.orderAreaM2 ?? tile.netAreaM2, "m2"), unique((tile.rooms || []).map((room) => titleRoom(room.roomName))).join(", ")], " - "), status: SCHEDULE_STATUS.selected, imageUrl: image(tile.imageUrl, found.imageUrl) });
      context.source(`Tile: ${text(tile.productName)}`, row);
      return row;
    });
  },
  // Rooms that share a floor covering are one line.
  "interior-flooring"(context, guided) {
    const lines = Array.isArray(guided.flooringLines) ? guided.flooringLines : [];
    if (!lines.length) return genericRow(context, guided, {});
    return lines.map((line, index) => {
      const rooms = unique((line.rooms || []).map((room) => text(room.name).replace(/\s*\(takeoff\)\s*$/i, "").replace(/\s*floor finish\s*$/i, " areas")));
      const row = makeRow(context, { id: line.lineId || index, item: line.flooringTypeLabel || "Flooring", product: line.productName, details: meaningful(line.dimensions), brandSupplier: join([line.brand, line.supplier]), modelCode: join([line.range, line.sku]),
        colourFinish: meaningful(line.colour), qtyLocation: join([formatQuantity(line.netAreaM2, "m2"), rooms.join(", ")], " - "), status: statusOf(guided, line), imageUrl: image(line.imageUrl) });
      context.source(`Flooring: ${text(line.productName)}`, row);
      return row;
    });
  },
  driveway(context, guided) {
    const driveway = guided.drivewaySelection || {};
    const row = makeRow(context, { item: "Driveway", product: join([driveway.finish || guided.productName], " "), brandSupplier: join([meaningful(driveway.supplierName || driveway.supplier || guided.supplier)]), modelCode: join([driveway.range, driveway.supplierCode]),
      colourFinish: join([driveway.mixName || meaningful(guided.colour), meaningful(driveway.surfaceFinish)], ", "), qtyLocation: formatQuantity(guided.boqLine?.drivewayAreaM2 ?? guided.quantity, "m2"), status: statusOf(guided), imageUrl: image(driveway.sampleImage, guided.imageReference) });
    context.source(`Driveway: ${row.product}`, row);
    return [row];
  },
  stairs(context, guided) {
    const stair = guided.stairConfiguration || {};
    const [row] = genericRow(context, guided, {});
    return [{ ...row, details: join([stair.planConfiguration, stair.timberSpecies && `${text(stair.timberSpecies)} timber`, join([stair.handrailFinish, stair.handrailProfile && `${text(stair.handrailProfile).toLowerCase()} handrail`], " ")], " · ") }];
  },  robes(context, guided) {
    const systems = Array.isArray(guided.robeSlidingDoorSystems) ? guided.robeSlidingDoorSystems : [];
    if (!systems.length) return genericRow(context, guided, {});
    return systems.map((system, index) => {
      const opening = `Opening: ${system.widthTopMm}/${system.widthBottomMm} x ${system.heightLeftMm}/${system.heightRightMm} mm`;
      const details = join([system.panelConfiguration || (system.panelCount ? `${system.panelCount}-panel` : ""), opening, system.trackConfiguration], " · ");
      const row = makeRow(context, { id: system.id || system.locationId || index, item: "Robe & Linen Sliding Doors", product: system.productName, details,
        brandSupplier: join([system.brand, system.supplier]), modelCode: join([system.sku || system.productCode]),
        colourFinish: join([system.frameColour && `Frame: ${system.frameColour}`, system.insertMaterial, meaningful(system.insertColour)], " · "),
        qtyLocation: join([`Qty ${formatQuantity(system.quantity, "EACH")}`, place(system.location)], " - "),
        status: system.configurationComplete && system.supplierConfirmed && system.quoteReference ? statusOf({ ...guided, productName: system.productName }) : SCHEDULE_STATUS.tbc,
        imageUrl: image(system.imageUrl) });
      context.source(`Robe/linen doors: ${text(system.productName)} - ${text(system.location)}`, row);
      return row;
    });
  },};

// ---- Extraction ------------------------------------------------------------------------------------
const guidedOf = (row = {}) => row.guidedSelection || row.selected_details?.guidedSelection || null;
const hiddenScope = (guided) => guided.displayInSelectionsSchedule === false || ["technical_inclusion", "boq_only", "procurement_only"].includes(text(guided.selectionScope)) || (text(guided.selectionScope) === "informational" && !guided.clientDecisionRequired);

// rows + reconciliation sources for every Client Selections record in the book.
//   options.productLookup(productId, productCode) -> { imageUrl, brand, supplier, colour, finish }
//   options.isHidden(row, guided) -> true for a selection the project does not have (brick on a clad house)
//   options.exteriorWalls -> the takeoff's exterior wall totals (see exteriorWallRows)
export function extractScheduleRows(book = {}, { productLookup = null, isHidden = null, exteriorWalls = [] } = {}) {
  const rows = [];
  const sources = [];
  let templatePlaceholders = 0;
  const selectionRecordIds = new Set();
  const excludedRecords = [];
  const lookup = (id, code) => { try { return (productLookup && productLookup(id, code)) || {}; } catch { return {}; } };
  const entries = [];
  for (const room of book.rooms || []) for (const row of room.rows || []) {
    const guided = guidedOf(row);
    if (!guided) { if (text(row.selectedProduct)) templatePlaceholders += 1; continue; }
    const sourceRecordId = text(row.id) || `saved-selection-${selectionRecordIds.size + 1}`;
    selectionRecordIds.add(sourceRecordId);
    const requirementKey = text(row.guidedRequirementKey || guided.requirementKey) || text(row.item).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (hiddenScope(guided)) { excludedRecords.push({ id: sourceRecordId, requirementKey, reason: "non-client selection scope" }); continue; }
    if (isHidden && isHidden(row, guided)) { excludedRecords.push({ id: sourceRecordId, requirementKey, reason: "not applicable to this project" }); continue; }
    entries.push({ row, guided, sourceRecordId, requirementKey });
  }
  // Exterior colours are placed last so a colour can be folded into the product row it belongs to.
  entries.sort((left, right) => (left.requirementKey === "exterior-paint") - (right.requirementKey === "exterior-paint"));
  const COMPONENT_ROWS = { roof: "roof", fascia: "fascia", gutters: "gutters", downpipes: "downpipes" };
  entries.forEach(({ row, guided, sourceRecordId, requirementKey }, index) => {
    const place = sectionAndGroup(requirementKey, guided);
    const context = { ...place, rows, rowId: row.id, sourceRecordId, requirementKey, sourceKey: `${requirementKey}:${row.id || index}`, label: text(guided.requirementLabel) || titleCase(requirementKey), lookup,
      productRowFor: (areaId) => (COMPONENT_ROWS[areaId] ? rows.find((item) => item.requirementKey === "roofing" && item.id.endsWith(`:${COMPONENT_ROWS[areaId]}`)) : null),
      source: (label, target, note = "") => sources.push({ label: text(label), section: target.section, rowId: target.id, sourceRecordId, requirementKey, consolidated: Boolean(note), note }) };
    const handler = HANDLERS[requirementKey];
    const made = handler ? handler(context, guided, row) : guided.plumbingAllocation?.lines?.length ? allocationRows(context, guided) : genericRow(context, guided, row);
    rows.push(...made);
  });
  rows.push(...exteriorWallRows(exteriorWalls, rows, sources));
  const representedRecords = new Set(sources.map((source) => source.sourceRecordId).filter(Boolean));
  const directlyRenderedRecords = new Set(sources.filter((source) => !source.consolidated).map((source) => source.sourceRecordId).filter(Boolean));
  const consolidatedRecords = new Set(sources.filter((source) => source.consolidated).map((source) => source.sourceRecordId).filter(Boolean));
  const missingRecords = entries.filter((entry) => !representedRecords.has(entry.sourceRecordId)).map((entry) => ({ id: entry.sourceRecordId, requirementKey: entry.requirementKey }));
  const recordReconciliation = {
    saved: selectionRecordIds.size,
    eligible: entries.length,
    represented: representedRecords.size,
    directlyRendered: directlyRenderedRecords.size,
    consolidatedOnly: [...consolidatedRecords].filter((id) => !directlyRenderedRecords.has(id)).length,
    excluded: excludedRecords,
    missing: missingRecords,
  };
  return { rows: rows.map((row) => ({ ...row, imageUrl: row.imageUrl || image(lookup(row.productId, row.modelCode).imageUrl) })), sources, templatePlaceholders, recordReconciliation };
}

// The external wall construction the plans record for each level ("Rendered Brick Veneer - Ground
// Floor"). It is not something chosen in Client Selections, so it has no selection record, but it
// is an exterior finish of the house and belongs in the envelope. Its lengths stay in the BOQ.
//   walls: [{ category, floor, itemId }] from the takeoff's exterior wall totals.
function exteriorWallRows(walls = [], rows = [], sources = []) {
  const groups = new Map();
  for (const wall of Array.isArray(walls) ? walls : []) {
    const category = text(wall?.category || wall?.exteriorClassification);
    if (!category || /^ext_total/i.test(text(wall?.itemId))) continue;
    const floor = text(wall.floor || wall.level);
    const key = `${category}|${floor}`.toLowerCase();
    if (!groups.has(key)) groups.set(key, { category, floor });
  }
  const context = { sourceKey: "exterior-walls", rows, rowId: "", requirementKey: "exterior-walls", section: "exterior", group: "exterior-envelope" };
  // A rendered wall's colour is paint: it is named here and specified in the Painting Schedule.
  const render = rows.find((row) => row.section === "painting" && /render/i.test(row.item) && row.status !== SCHEDULE_STATUS.tbc);
  return [...groups.values()].map(({ category, floor }, index) => {
    const row = makeRow(context, { id: `wall-${index}`, item: join(["External Walls", floor], " - "), product: category, colourFinish: /render/i.test(category) && render ? `Render colour: ${render.product} (see Painting Schedule)` : "", status: SCHEDULE_STATUS.included });
    sources.push({ label: `External walls: ${category}${floor ? ` - ${floor}` : ""}`, section: "exterior", rowId: row.id, sourceRecordId: "", requirementKey: "exterior-walls", consolidated: false, note: "" });
    return row;
  });
}

// ---- Structure and pagination ---------------------------------------------------------------------
// Sections in order, each with its groups in order, each with its rows. Empty groups are left out.
const ENVELOPE_ORDER = [/^roof\b/i, /fascia/i, /gutter/i, /downpipe/i, /external walls/i, /cladding/i, /brick/i, /render/i];
const envelopeRank = (row) => { const rank = ENVELOPE_ORDER.findIndex((pattern) => pattern.test(row.item)); return rank < 0 ? ENVELOPE_ORDER.length : rank; };
export function structureSchedule(rows = []) {
  const inGroup = (section, group) => { const found = rows.filter((row) => row.section === section.key && row.group === group.key); return group.key === "exterior-envelope" ? found.map((row, index) => [row, index]).sort((left, right) => envelopeRank(left[0]) - envelopeRank(right[0]) || left[1] - right[1]).map(([row]) => row) : found; };
  return SCHEDULE_SECTIONS.map((section) => ({ ...section,
    groups: GROUPS[section.key].map((group) => ({ key: group.key, title: group.title, rows: inGroup(section, group) })).filter((group) => group.rows.length) }))
    .filter((section) => section.groups.length);
}

// Page capacity is measured in row units, not categories. One unit is a plain single-line row
// (2.7% of the page width tall, the .ssRow height in the page styles); an image row and a row that
// wraps take more. The printed landscape A4 body holds SCHEDULE_PAGE_UNITS. The figures below are
// the page's own measurements: change the styles and these together.
// The landscape A4 renderer uses container-query widths: body space is page height minus
// header/footer and body padding, or 60.9cqw. Keep these units in sync with selectionsScheduleHtml.js.
export const SCHEDULE_PAGE_UNITS = 60.9;
const UNIT = { section: 4.2, group: 2.5, tableHead: 2.3 };
const LINE = 1.3125, PADDING = 0.6, IMAGE_ROW = 3.6, MIN_ROW = 2.7;
const wrapLines = (value, perLine) => { const words = text(value); return words ? Math.max(1, Math.ceil(words.length / perLine)) : 0; };
export function rowUnits(row) {
  // Characters that fit one line of each column at the page's type size.
  const visual = Boolean(row.imageUrl || row.swatch);
  const lines = Math.max(1, wrapLines(row.product, 33) + wrapLines(row.details, 38) * 0.92, wrapLines(row.qtyLocation, 30), wrapLines(row.colourFinish, row.imageUrl && row.swatch ? 16 : 19), wrapLines(row.brandSupplier, 17), wrapLines(row.modelCode, 12), wrapLines(row.item, visual ? 14 : 25));
  return Math.max(row.imageUrl ? IMAGE_ROW : MIN_ROW, PADDING + lines * LINE);
}
// pages: [{ number, section: { key, number, title }, continued, blocks: [section | group | row] }]
export function paginateSchedule(sections = [], { capacity = SCHEDULE_PAGE_UNITS, firstPageNumber = 1 } = {}) {
  const pages = [];
  let page = null, used = 0;
  const open = (section, continued) => { page = { number: firstPageNumber + pages.length, section: { key: section.key, number: section.number, title: section.title }, continued, blocks: [] }; pages.push(page); used = UNIT.tableHead; };
  for (const section of sections) {
    // A section follows on the same page when a heading, a subheading and a few rows still fit.
    const opening = UNIT.section + UNIT.group + section.groups[0].rows.slice(0, 3).reduce((total, row) => total + rowUnits(row), 0);
    if (!page || used + opening > capacity) open(section, false);
    page.blocks.push({ type: "section", key: section.key, number: section.number, title: section.title }); used += UNIT.section;
    for (const group of section.groups) {
      // A subheading is never left alone at the foot of a page.
      if (used + UNIT.group + rowUnits(group.rows[0]) > capacity) open(section, true);
      page.blocks.push({ type: "group", key: group.key, title: group.title, continued: false }); used += UNIT.group;
      group.rows.forEach((row) => {
        const units = rowUnits(row);
        if (used + units > capacity) { open(section, true); page.blocks.push({ type: "group", key: group.key, title: group.title, continued: true }); used += UNIT.group; }
        page.blocks.push({ type: "row", row }); used += units;
      });
    }
  }
  // A single last row is not given a page to itself: it joins the page before it, within the
  // small margin the page keeps.
  const last = pages.at(-1), before = pages.at(-2);
  const lastRows = last ? last.blocks.filter((block) => block.type === "row") : [];
  const unitsOf = (item) => item.blocks.reduce((total, block) => total + (block.type === "row" ? rowUnits(block.row) : UNIT[block.type]), UNIT.tableHead);
  if (before && lastRows.length === 1 && last.blocks.every((block) => block.type === "row" || (block.type === "group" && block.continued)) && unitsOf(before) + rowUnits(lastRows[0].row) <= capacity * 1.08) {
    before.blocks.push(lastRows[0]); pages.pop();
  }
  const fillOf = (blocks) => Math.min(1, round(blocks.reduce((total, block) => total + (block.type === "row" ? rowUnits(block.row) : UNIT[block.type]), UNIT.tableHead) / capacity));
  for (let pass = 0; pass < pages.length; pass += 1) {
    let changed = false;
    for (let pageIndex = pages.length - 1; pageIndex > 0; pageIndex -= 1) {
      const destination = pages[pageIndex];
      const source = pages[pageIndex - 1];
      if (fillOf(destination.blocks) >= 0.72) continue;
      const groupIndex = source.blocks.findLastIndex((block) => block.type === "group");
      const sectionIndex = source.blocks.findLastIndex((block) => block.type === "section" && block.key === destination.section.key);
      const group = source.blocks[groupIndex];
      if (!group || (source.section.key !== destination.section.key && sectionIndex < 0)) continue;
      if (source.blocks.slice(groupIndex + 1).some((block) => block.type !== "row")) continue;

      const moved = [];
      const destinationHasGroup = destination.blocks[0]?.type === "group" && destination.blocks[0].key === group.key;
      const groupContinuation = destinationHasGroup ? destination.blocks[0] : { type: "group", key: group.key, title: group.title, continued: true };
      const destinationTail = destinationHasGroup ? destination.blocks.slice(1) : destination.blocks;
      while (source.blocks.at(-1)?.type === "row" && fillOf([groupContinuation, ...moved, ...destinationTail]) < 0.72) {
        const candidate = source.blocks.at(-1);
        const remaining = source.blocks.slice(0, -1);
        if (fillOf(remaining) < 0.6) break;
        source.blocks.pop();
        moved.unshift(candidate);
      }

      if (moved.length) {
        changed = true;
        destination.blocks = [groupContinuation, ...moved, ...destinationTail];
        if (!source.blocks.slice(groupIndex + 1).some((block) => block.type === "row")) {
          source.blocks.splice(groupIndex, 1);
          const remainingSectionIndex = source.blocks.findLastIndex((block) => block.type === "section" && block.key === destination.section.key);
          if (remainingSectionIndex >= 0 && !source.blocks.slice(remainingSectionIndex + 1).some((block) => block.type === "group")) {
            const [sectionHeading] = source.blocks.splice(remainingSectionIndex, 1);
            destination.blocks.unshift(sectionHeading);
            destination.continued = false;
          }
        }
      }
    }
    if (!changed) break;
  }
  return pages.map((item) => ({ ...item, fill: 0 })).map((item) => ({ ...item, fill: Math.min(1, round(item.blocks.reduce((total, block) => total + (block.type === "row" ? rowUnits(block.row) : UNIT[block.type]), UNIT.tableHead) / capacity)) }));
}

// ---- Reconciliation --------------------------------------------------------------------------------
export function reconcileSchedule({ rows = [], sources = [], pages = [], templatePlaceholders = 0, recordReconciliation = null } = {}) {
  const printed = new Set(pages.flatMap((page) => page.blocks.filter((block) => block.type === "row").map((block) => block.row.id)));
  const rowIds = new Set(rows.map((row) => row.id));
  const missing = sources.filter((source) => !rowIds.has(source.rowId));
  const unrendered = rows.filter((row) => !printed.has(row.id));
  const signature = (row) => [row.section, row.group, row.item, row.product, row.modelCode, row.colourFinish, row.qtyLocation].join("|").toLowerCase();
  const seen = new Map();
  const duplicated = rows.filter((row) => { const key = signature(row); if (seen.has(key)) return true; seen.set(key, row.id); return false; });
  const rawObjects = rows.filter((row) => /\[object |^\s*[{[]"/.test(Object.values(row).filter((value) => typeof value === "string").join(" ")));
  const count = (key) => ({ sources: sources.filter((source) => source.section === key).length, rendered: sources.filter((source) => source.section === key && !source.consolidated).length,
    consolidated: sources.filter((source) => source.section === key && source.consolidated).length, rows: rows.filter((row) => row.section === key).length });
  // A page that is mostly empty is only acceptable as the last page of the document.
  const sparsePages = pages.filter((page, index) => index < pages.length - 1 && page.fill < 0.55).map((page) => ({ number: page.number, fill: page.fill }));
  const records = recordReconciliation || { saved: 0, eligible: 0, represented: 0, directlyRendered: 0, consolidatedOnly: 0, excluded: [], missing: [] };
  return { totalSelections: sources.length, scheduleSourceEntries: sources.length, records, exterior: count("exterior"), interior: count("interior"), painting: count("painting"), missing, duplicated, unrendered, rawObjects, sparsePages, templatePlaceholders, pageCount: pages.length,
    ok: !missing.length && !duplicated.length && !unrendered.length && !rawObjects.length && !sparsePages.length && !records.missing.length };
}

// The whole schedule body for a Selections Book.
export function buildSelectionsSchedule(book = {}, options = {}) {
  const { rows, sources, templatePlaceholders, recordReconciliation } = extractScheduleRows(book, options);
  const sections = structureSchedule(rows);
  const pages = paginateSchedule(sections, options);
  return { rows, sections, pages, sources, reconciliation: reconcileSchedule({ rows, sources, pages, templatePlaceholders, recordReconciliation }) };
}
