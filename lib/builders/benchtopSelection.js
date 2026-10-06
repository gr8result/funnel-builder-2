// Client Selections > Cabinetry > Benchtops.
//
// PROJECT GEOMETRY / QUANTITY is separate from CLIENT PRODUCT SELECTION:
//   The project decides  - which benchtop areas exist (main bench, an island the cabinetry scope
//                          already shows, each vanity), their dimensions where known, the quantity.
//   The client decides   - surface / colour, edge, waterfall ends and upstand where they apply,
//                          and confirms the cut-outs.
// Client Selections never asks for geometry the project already holds, and never invents a
// dimension it does not hold: an area with no known length says so and takes a structured entry.
//
// The order on screen is the order of decision: 1. setup  2. areas  3. surface  4. summary.
// Fabrication and supplier administration (slab thickness, finished edge, template, supplier quote,
// sample sign-off) is not asked of the client. It stays on the saved surface record with
// supplierConfirmationStatus "required" for Supplier & Procurement to resolve. Nor is the client
// asked for the quotation range: a surface inherits it from its supplier price group
// (benchtopRangeMapping.js).
//
// Stored on the cabinetry location:
//   benchtopSetup: { edgeProfile, waterfallEnds, upstand, upstandCustomMm, cutouts, cutoutNote, confirmedAt, islandRemoved }
//   benchtopAreas: [{ id, label, lengthMm, depthMm, source, surface }]
//   benchtop / benchtops (joinery rooms) and bathroomBenchtops (vanities): kept in step, because
//   the summary, BOQ, RFQ and completion checks read them.
// The Quotation Builder quantity is the areas' length in LM on the row of each surface's quotation
// range (cabinetryRequirements.js) - never a free-text dimension.

import { BENCHTOP_RANGES, cabinetryRequirementTypes, cabinetryRoomGroup, legacyCabinetryScheduleType } from "../construction-estimation/cabinetryRequirements.js";
import { CUTOUT_OPTIONS, STONE_BENCHTOP_EDGE_PROFILES, WATERFALL_END_OPTIONS, configureStoneBenchtopSelection } from "./stoneBenchtopWorkflow.js";
import { benchtopPriceGroupKey, mappedBenchtopRangeKey, supplierPriceGroupOf } from "./benchtopRangeMapping.js";

export const BENCHTOP_UPSTAND_OPTIONS = ["None", "100mm", "Custom"];
export const BENCHTOP_SAMPLE_NOTE = "Final colour should be confirmed from a current physical sample.";
export const BENCHTOP_AREA_PRESETS = ["Island", "Breakfast bar", "Return bench", "Other"];
export const SUPPLIER_CONFIRMATION_REQUIRED = "required";
export const ISLAND_AREA_ID = "benchtop-island";
export const VANITY_EDGE_PROFILES = ["Square arris", "Pencil round", "Mitred drop front", "Builder/supplier nominated"];
const VANITY_TARGETS = [["floorMountedVanity", "Floor-mounted vanity benchtop", /^vanity_floor/], ["wallMountedVanity", "Wall-mounted vanity benchtop", /^vanity_wallhung/]];
export { CUTOUT_OPTIONS, STONE_BENCHTOP_EDGE_PROFILES, WATERFALL_END_OPTIONS };

const text = (value) => String(value ?? "").trim();
const positive = (value) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 0);
const round2 = (value) => Math.round(value * 100) / 100;
const slug = (value) => text(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const roomOf = (location = {}) => location.location || location.name || "";

// ---- What kind of benchtops a room has ----------------------------------------------------------
// A kitchen bench and a bathroom vanity top ask different things. Each profile lists only what
// applies: a vanity has a basin and a tap, no cooktop, no waterfall ends and no island.
export function benchtopProfile(location = {}) {
  const room = roomOf(location);
  const group = cabinetryRoomGroup(room);
  if (group === "bathroom") {
    const scope = Array.isArray(location.bathroomScopeKeys) ? location.bathroomScopeKeys : Array.isArray(location.bathroomScope) ? location.bathroomScope : [];
    return { variant: "vanity", title: "Vanity benchtop", cutouts: ["Sink", "Tap"], cutoutLabels: { Sink: "Basin", Tap: "Tap / Mixer" }, edgeProfiles: VANITY_EDGE_PROFILES, waterfall: false, canAddAreas: false,
      fixedAreas: VANITY_TARGETS.filter(([key]) => scope.includes(key)).map(([id, label, types]) => ({ id, label, types })) };
  }
  const cooktop = cabinetryRequirementTypes(group || "kitchen").some((type) => type.key === "benchtop_cooktop_cutout");
  return { variant: "bench", title: "Benchtop", cutouts: CUTOUT_OPTIONS.filter((name) => name !== "Cooktop" || cooktop), cutoutLabels: { Sink: "Sink", Cooktop: "Cooktop", Tap: "Tap / Mixer", Other: "Other" },
    edgeProfiles: STONE_BENCHTOP_EDGE_PROFILES, waterfall: true, canAddAreas: true, fixedAreas: null };
}

// The benchtop depths the quotation prices for this room (600 / 900 / 1200 mm wide, per LM).
export function benchtopDepthsForRoom(room = "") {
  const group = cabinetryRoomGroup(room) || "kitchen";
  const depths = cabinetryRequirementTypes(group).filter((type) => type.area === "benchtops" && type.widthMm).map((type) => type.widthMm);
  return [...new Set(depths)].sort((a, b) => a - b);
}

export function defaultBenchtopAreaLabel(room = "") {
  if (/laundry/i.test(room)) return "Laundry benchtop";
  if (/pantry/i.test(room)) return "Butler's Pantry benchtop";
  return "Main benchtop";
}

// ---- What the project already knows ------------------------------------------------------------
const lineType = (line = {}) => line.cabinetTypeId || legacyCabinetryScheduleType(line)?.type || "";
const scheduledQuantity = (line = {}) => positive(line.quantity);
const BENCH_HEIGHT_TYPES = /^(base_unit|sink_base|underbench_oven|corner_base|dishwasher_opening|pullout_bin|drawer_base|washer_dryer_opening)/;

// Sink / cooktop / basin already in the room's cabinet schedule or the project's selections, so the
// client is not asked to recreate them.
export function knownBenchtopCutouts(scheduleLines = [], { hasSink = false, hasCooktop = false, hasBasin = false } = {}, profile = { variant: "bench", cutouts: CUTOUT_OPTIONS }) {
  const types = scheduleLines.filter((line) => scheduledQuantity(line) > 0).map(lineType);
  const cutouts = [];
  if (profile.variant === "vanity") { if (hasBasin) cutouts.push("Sink", "Tap"); }
  else {
    if (hasSink || types.includes("sink_base")) cutouts.push("Sink", "Tap");
    if (hasCooktop) cutouts.push("Cooktop");
  }
  return cutouts.filter((name) => profile.cutouts.includes(name));
}

// The run the room's cabinet schedule adds up to, over the cabinets of `types`. Only cabinets with
// a recorded width count: { lengthMm, counted, unknown: [labels] }. A cabinet without a width is
// reported, never assumed.
export function benchRunFromSchedule(scheduleLines = [], room = "", types = BENCH_HEIGHT_TYPES) {
  const group = cabinetryRoomGroup(room) || "kitchen";
  const labels = new Map(cabinetryRequirementTypes(group).map((type) => [type.key, type.label]));
  let lengthMm = 0;
  let counted = 0;
  const unknown = [];
  scheduleLines.forEach((line) => {
    const type = lineType(line);
    const quantity = scheduledQuantity(line);
    if (!quantity || !types.test(type)) return;
    const width = positive(line.width) || positive(type.match(/_(\d{3,4})(_|$)/)?.[1]);
    if (width) { lengthMm += width * quantity; counted += quantity; }
    else unknown.push(labels.get(type) || line.unitType || line.type || type);
  });
  return { lengthMm, counted, unknown };
}

// Whether the project itself says this room has an island bench, and where it says so. Strong
// evidence only: the cabinetry scope's Island bench back, an island on the cabinet schedule, or a
// cabinetry requirement from Job Setup / the takeoff that names an island. A kitchen is never
// given an island because kitchens often have one. Returns "" when there is no such evidence.
export function islandEvidence(location = {}, { scheduleLines = [], workbook = null } = {}) {
  if (benchtopProfile(location).variant !== "bench") return "";
  const scope = [...(location.enabledAreaKeys || []), ...(location.scope || [])];
  if (scope.includes("islandBenchBack") || location.areaSelections?.islandBenchBack?.colourName || location.areaSelections?.islandBenchBack?.id) return "Cabinetry scope: Island bench back";
  if (scheduleLines.some((line) => scheduledQuantity(line) > 0 && /\bisland\b/i.test(`${line.unitType} ${line.type} ${line.cabinetTypeId} ${line.notes}`))) return "Cabinet schedule: island unit";
  const roomKey = slug(roomOf(location));
  const takeoff = workbook?.aiPlanTakeoffJob || workbook?.takeoffEngine?.aiPlanTakeoffJob || {};
  const analysis = takeoff.aiAnalysis || takeoff.scheduleState?.aiAnalysis || {};
  const list = (value) => (Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : []);
  const named = (item) => slug(item?.room || item?.location || item?.roomLabel) === roomKey && item?.basis !== "ASSUMED" && !(Number(item?.confidence) < 0.5) && /\bisland\b/i.test(`${item.type} ${item.requirementType} ${item.label} ${item.description} ${item.name}`);
  if ([...list(workbook?.cabinetryRequirements), ...list(workbook?.data?.cabinetryRequirements)].some(named)) return "Job Setup: island cabinetry";
  if ([...list(takeoff.cabinetryRequirements), ...list(takeoff.scheduleState?.cabinetryRequirements), ...list(analysis.cabinetry)].some(named)) return "AI Plan Takeoff: island cabinetry";
  return "";
}

// ---- Setup and areas ---------------------------------------------------------------------------
export function benchtopSetupFor(location = {}, { scheduleLines = [], project = {} } = {}) {
  const profile = benchtopProfile(location);
  const saved = location.benchtopSetup;
  if (saved && typeof saved === "object") {
    return { edgeProfile: profile.edgeProfiles.includes(saved.edgeProfile) ? saved.edgeProfile : profile.edgeProfiles[0], waterfallEnds: profile.waterfall ? saved.waterfallEnds || "None" : "None", upstand: BENCHTOP_UPSTAND_OPTIONS.includes(saved.upstand) ? saved.upstand : "None",
      upstandCustomMm: saved.upstandCustomMm ?? "", cutouts: Array.isArray(saved.cutouts) ? saved.cutouts.filter((item) => profile.cutouts.includes(item)) : [], cutoutNote: text(saved.cutoutNote), confirmedAt: saved.confirmedAt || "", islandRemoved: Boolean(saved.islandRemoved) };
  }
  // First visit: start from an earlier selection's setup, else from what the project already shows.
  const earlierVanity = profile.variant === "vanity" ? Object.values(location.bathroomBenchtops || {}).find((record) => record && typeof record === "object") : null;
  const earlier = profile.variant === "bench" && location.benchtop?.materialChoice === "stone" ? location.benchtop : null;
  const known = knownBenchtopCutouts(scheduleLines, project, profile);
  const upstandMm = positive(String(earlier?.upstand || "").match(/\d+/)?.[0]);
  const earlierEdge = /mitred/i.test(`${earlierVanity?.materialChoice} ${earlierVanity?.dropFrontDetail}`) ? "Mitred drop front" : earlier?.edgeProfile;
  return { edgeProfile: profile.edgeProfiles.includes(earlierEdge) ? earlierEdge : profile.edgeProfiles[0], waterfallEnds: profile.waterfall ? earlier?.waterfallEnds || "None" : "None", upstand: !upstandMm ? "None" : upstandMm === 100 ? "100mm" : "Custom", upstandCustomMm: upstandMm && upstandMm !== 100 ? upstandMm : "",
    cutouts: earlier?.cutouts?.length ? earlier.cutouts.filter((item) => profile.cutouts.includes(item)) : known, cutoutNote: "", confirmedAt: "", islandRemoved: false, prefilledCutouts: earlier?.cutouts?.length ? [] : known };
}

export function benchtopSetupComplete(setup = {}) {
  return Boolean(setup?.confirmedAt);
}

export function newBenchtopArea(label = "", { depthMm = 600, lengthMm = "", source = "manual" } = {}) {
  return { id: `benchtop-${slug(label) || "area"}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, label: text(label) || "Benchtop", lengthMm, depthMm, source, surface: null };
}

const isProductRecord = (record) => Boolean(record && typeof record === "object" && (record.productId || record.id || record.rangeKey));

// The benchtop areas the PROJECT says this room has, with any saved lengths and surfaces laid over:
//   vanity rooms - one area per vanity in the bathroom scope, length from the vanity cabinets
//   other rooms  - the main run (length from the cabinet schedule where every cabinet has a width)
//                  plus an Island benchtop when the project shows an island (islandEvidence)
// A length the project does not hold is left empty for a structured entry; it is never invented.
export function benchtopAreasFor(location = {}, { scheduleLines = [], workbook = null } = {}) {
  const room = roomOf(location);
  const depths = benchtopDepthsForRoom(room);
  const profile = benchtopProfile(location);
  const saved = Array.isArray(location.benchtopAreas) ? location.benchtopAreas : [];
  const clean = (area, index) => ({ id: area.id || `benchtop-area-${index + 1}`, label: text(area.label) || "Benchtop", lengthMm: positive(area.lengthMm) || "", depthMm: depths.includes(Number(area.depthMm)) ? Number(area.depthMm) : depths[0], source: area.source || "manual", surface: area.surface || null });
  if (profile.variant === "vanity") {
    return profile.fixedAreas.map((target, index) => {
      const previous = saved.find((area) => area.id === target.id);
      if (previous) return { ...clean(previous, index), id: target.id, label: target.label };
      const run = benchRunFromSchedule(scheduleLines, room, target.types);
      const complete = run.lengthMm > 0 && !run.unknown.length;
      const earlier = location.bathroomBenchtops?.[target.id];
      return { id: target.id, label: target.label, lengthMm: complete ? run.lengthMm : "", depthMm: depths[0], source: complete ? "cabinetry" : "manual", surface: isProductRecord(earlier) ? earlier : null };
    });
  }
  const island = islandEvidence(location, { scheduleLines, workbook });
  const islandArea = () => ({ id: ISLAND_AREA_ID, label: "Island benchtop", lengthMm: "", depthMm: depths.includes(900) ? 900 : depths[0], source: "project", evidence: island, surface: null });
  if (saved.length) {
    const areas = saved.map(clean);
    // An island the project shows is listed without the user having to add it - unless they removed it.
    return island && !location.benchtopSetup?.islandRemoved && !areas.some((area) => area.id === ISLAND_AREA_ID || /\bisland\b/i.test(area.label)) ? [...areas, islandArea()] : areas;
  }
  const run = benchRunFromSchedule(scheduleLines, room);
  const complete = run.lengthMm > 0 && !run.unknown.length;
  const main = { id: "benchtop-main", label: defaultBenchtopAreaLabel(room), lengthMm: complete ? run.lengthMm : "", depthMm: depths[0], source: complete ? "cabinetry" : "manual", surface: isProductRecord(location.benchtop || location.benchtops) ? location.benchtop || location.benchtops : null };
  return island ? [main, islandArea()] : [main];
}

export const benchtopAreaLm = (area = {}) => round2(positive(area.lengthMm) / 1000);

export function benchtopQuantitySummary(areas = []) {
  const lines = areas.map((area) => ({ id: area.id, label: area.label, lm: benchtopAreaLm(area), depthMm: area.depthMm, source: area.source }));
  return { lines, totalLm: round2(lines.reduce((total, line) => total + line.lm, 0)), missing: lines.filter((line) => !line.lm).map((line) => line.label) };
}

// ---- Quotation range ----------------------------------------------------------------------------
// ranges: { mapping, classifications } - the builder's supplier price group mapping, and the
// per-job confirmations made before that mapping existed (kept where still valid).
// Order: the product's own range -> the builder's mapping for its supplier price group -> an
// earlier confirmation on this job -> porcelain / sintered by material. Otherwise unset: a price
// group is never guessed onto a tier.
export const benchtopRangeByKey = (key = "") => BENCHTOP_RANGES.find((range) => range.key === key) || null;
export const benchtopClassificationKey = benchtopPriceGroupKey;
const legacyProductKey = (product = {}) => `${slug(product.supplier)}|product-${slug(product.id || product.productCode || product.colourName)}`;

export function benchtopRangeFor(product = {}, { mapping = null, classifications = {} } = {}) {
  if (!product) return { rangeKey: "", source: "" };
  const own = product.benchtopRangeKey || product.rangeKey;
  if (benchtopRangeByKey(own)) return { rangeKey: own, source: "product" };
  const key = benchtopPriceGroupKey(product);
  const mapped = mappedBenchtopRangeKey(mapping, key);
  if (mapped) return { rangeKey: mapped, source: "supplier-price-group" };
  const confirmed = classifications?.[key] || classifications?.[legacyProductKey(product)] || classifications?.[`${slug(product.supplier)}|${slug(product.priceGroup)}`];
  if (benchtopRangeByKey(confirmed)) return { rangeKey: confirmed, source: "job-confirmation" };
  if (/porcelain|sintered/i.test(`${product.materialType} ${product.category}`)) return { rangeKey: "porcelain_sintered", source: "material" };
  return { rangeKey: "", source: "" };
}
export const benchtopRangeKeyFor = (product, ranges) => benchtopRangeFor(product, ranges).rangeKey;

// ---- Surfaces -----------------------------------------------------------------------------------
const upstandText = (setup = {}) => (setup.upstand === "Custom" ? `${positive(setup.upstandCustomMm) || ""} mm`.trim() : setup.upstand === "100mm" ? "100 mm" : "");

// The saved record for a stone / porcelain / sintered product on one area. The client's setup is
// applied; everything the fabricator settles is recorded as needing supplier confirmation. Both
// the supplier's own price group and the GR8 canonical range are kept.
export function stoneSurfaceForArea(product = {}, { room = "", area = {}, setup = {}, ranges = {} } = {}) {
  const range = benchtopRangeFor(product, ranges);
  return {
    ...configureStoneBenchtopSelection(product, { room, applications: [area.label], edgeProfile: setup.edgeProfile, waterfallEnds: setup.waterfallEnds, upstand: upstandText(setup), cutouts: setup.cutouts, notes: setup.cutoutNote, pricingStatus: product.priceStatus }),
    materialChoice: "stone",
    category: "Stone, Porcelain & Sintered Benchtops",
    range: product.collection || "",
    productRange: product.collection || "",
    colour: product.colourName || "",
    thickness: "",
    rangeKey: range.rangeKey,
    benchtopRangeKey: range.rangeKey,
    rangeSource: range.source,
    rangeOverrideKey: "",
    classificationKey: benchtopPriceGroupKey(product),
    supplierPriceGroup: supplierPriceGroupOf(product),
    supplierConfirmationStatus: SUPPLIER_CONFIRMATION_REQUIRED,
  };
}

export function laminateSurfaceForArea(bench = {}, { area = {}, setup = {} } = {}) {
  const rangeKey = benchtopRangeByKey(bench.rangeKey) ? bench.rangeKey : "standard_laminate";
  return { ...bench, materialChoice: "laminate", productRange: bench.range || "", colourName: bench.colourName || "", applications: [area.label], edgeProfile: setup.edgeProfile, cutouts: setup.cutouts, rangeKey, benchtopRangeKey: rangeKey, rangeSource: "product", rangeOverrideKey: "", supplierConfirmationStatus: SUPPLIER_CONFIRMATION_REQUIRED };
}

// A surface already on an area follows a later change to the setup or to the builder's mapping.
// A deliberate override on the benchtop wins; a range confirmed earlier is kept where nothing
// newer replaces it.
export function surfaceWithSetup(surface = null, { area = {}, setup = {}, ranges = {} } = {}) {
  if (!surface) return surface;
  const mapped = surface.classificationKey ? mappedBenchtopRangeKey(ranges.mapping, surface.classificationKey) : "";
  const confirmed = surface.classificationKey && benchtopRangeByKey(ranges.classifications?.[surface.classificationKey]) ? ranges.classifications[surface.classificationKey] : "";
  const override = benchtopRangeByKey(surface.rangeOverrideKey) ? surface.rangeOverrideKey : "";
  const rangeKey = override || mapped || confirmed || surface.rangeKey || "";
  return { ...surface, applications: [area.label], edgeProfile: setup.edgeProfile, waterfallEnds: setup.waterfallEnds, upstand: upstandText(setup), cutouts: setup.cutouts, rangeKey, benchtopRangeKey: rangeKey,
    rangeSource: override ? "override" : mapped ? "supplier-price-group" : confirmed ? "job-confirmation" : surface.rangeSource || "" };
}

// The location fields for a change to its setup / areas, keeping the older fields other parts of
// the app read in step: `benchtop` (first surface) for joinery rooms, `bathroomBenchtops` for vanities.
export function benchtopLocationPatch({ location = {}, setup, areas, ranges = {} }) {
  const profile = benchtopProfile(location);
  const next = areas.map(({ evidence, ...area }) => ({ ...area, surface: surfaceWithSetup(area.surface, { area, setup, ranges }) }));
  const { prefilledCutouts, ...savedSetup } = setup;
  const patch = { benchtopSetup: savedSetup, benchtopAreas: next, benchtopEdge: setup.edgeProfile, benchtopUpstand: setup.upstand === "Custom" ? upstandText(setup) : setup.upstand, benchtopDimensions: "" };
  if (profile.variant === "vanity") {
    const records = Object.fromEntries(next.filter((area) => area.surface).map((area) => [area.id, { ...area.surface, targetKey: area.id, targetLabel: area.label, productRange: area.surface.productRange || area.surface.collection || area.surface.range || "" }]));
    return { ...patch, bathroomBenchtops: records, benchtops: { bathroom: records } };
  }
  const first = next.find((area) => area.surface)?.surface || null;
  return { ...patch, benchtop: first, benchtops: first };
}

// "configured" | "setup" | "areas" | "surfaces" - what the room still needs, in workflow order.
export function benchtopNextStep(setup = {}, areas = []) {
  if (!benchtopSetupComplete(setup)) return "setup";
  if (areas.some((area) => !benchtopAreaLm(area))) return "areas";
  if (areas.some((area) => !area.surface)) return "surfaces";
  return "configured";
}
