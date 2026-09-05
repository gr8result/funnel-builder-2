import { numberValue, roundMoney } from "./selectionBudget.js";
import {
  LAMINEX_CABINETRY_CATALOGUE,
  POLYTEC_CABINETRY_CATALOGUE,
  PRODUCT_LIBRARY_CABINETRY_AREA_KEYS,
  PRODUCT_LIBRARY_CABINETRY_AREA_LABELS,
  PRODUCT_LIBRARY_CABINETRY_DOOR_MATERIAL_GROUPS,
  PRODUCT_LIBRARY_CABINETRY_LOCATION_AREA_KEYS,
  PRODUCT_LIBRARY_CABINETRY_LOCATION_OPTIONS,
  PRODUCT_LIBRARY_CABINETRY_PRICING_TIERS,
  PRODUCT_LIBRARY_CABINETRY_SCHEDULE_TYPE_OPTIONS,
  PRODUCT_LIBRARY_CABINETRY_WORKFLOW_STAGES,
  PRODUCT_LIBRARY_HANDLE_HOUSE_CATALOGUE,
  PRODUCT_LIBRARY_WET_AREA_CABINETRY_AREA_KEYS,
  PRODUCT_LIBRARY_WET_AREA_CABINETRY_ROOM_NAMES,
  PRODUCT_LIBRARY_WET_AREA_CABINETRY_SCHEDULE_TYPES,
} from "../product-library/cabinetryCatalogueSelectors.js";
import { buildStoneSupplierRfq, stoneBenchtopToBoqLine } from "./stoneBenchtopWorkflow.js";

export { LAMINEX_CABINETRY_CATALOGUE, POLYTEC_CABINETRY_CATALOGUE };

export const CABINETRY_REQUIREMENT_ALIASES = ["cabinetry", "cabinet-finish", "handles", "benchtop", "cabinet-doors", "cabinet-handles", "benchtops"];

export const CABINETRY_WORKFLOW_STAGES = PRODUCT_LIBRARY_CABINETRY_WORKFLOW_STAGES;
export const CABINETRY_LOCATIONS = PRODUCT_LIBRARY_CABINETRY_LOCATION_OPTIONS;
export const CABINETRY_AREA_KEYS = PRODUCT_LIBRARY_CABINETRY_AREA_KEYS;
export const CABINETRY_AREA_LABELS = PRODUCT_LIBRARY_CABINETRY_AREA_LABELS;
export const CABINETRY_LOCATION_AREA_KEYS = PRODUCT_LIBRARY_CABINETRY_LOCATION_AREA_KEYS;
export const CABINETRY_SCHEDULE_TYPE_OPTIONS = PRODUCT_LIBRARY_CABINETRY_SCHEDULE_TYPE_OPTIONS;
export const WET_AREA_CABINETRY_ROOM_NAMES = PRODUCT_LIBRARY_WET_AREA_CABINETRY_ROOM_NAMES;
export const WET_AREA_CABINETRY_AREA_KEYS = PRODUCT_LIBRARY_WET_AREA_CABINETRY_AREA_KEYS;
export const WET_AREA_CABINETRY_SCHEDULE_TYPES = PRODUCT_LIBRARY_WET_AREA_CABINETRY_SCHEDULE_TYPES;
export const CABINETRY_PRICING_TIERS = PRODUCT_LIBRARY_CABINETRY_PRICING_TIERS;

export const HANDLE_HOUSE_BASE_CATALOGUE = PRODUCT_LIBRARY_HANDLE_HOUSE_CATALOGUE;

export const CABINETRY_DOOR_MATERIAL_GROUPS = PRODUCT_LIBRARY_CABINETRY_DOOR_MATERIAL_GROUPS;

export const CABINETRY_BENCHTOPS = [
  { id: "laminated-laminex", category: "Laminated", supplier: "Laminex", range: "Laminate", colour: "Builder/client selected official colour", finish: "Supplier selected laminate finish", thickness: "Laminated", thicknessConfiguration: "Laminate build-up to supplier specification", priceStatus: "price_pending", sourceUrl: "https://www.laminex.com.au/" },
  { id: "laminated-polytec", category: "Laminated", supplier: "Polytec", range: "Laminate", colour: "Builder/client selected official colour", finish: "Supplier selected laminate finish", thickness: "Laminated", thicknessConfiguration: "Laminate build-up to supplier specification", priceStatus: "price_pending", sourceUrl: "https://www.polytec.com.au/" },
  { id: "stone-20mm", category: "Stone/mineral surfaces", supplier: "Builder stone supplier", range: "Stone/mineral surface", colour: "Supplier quote colour", thickness: "20 mm", thicknessConfiguration: "Solid thickness or supplier configuration required", priceStatus: "quote_required", sourceUrl: "" },
  { id: "stone-40mm-built-up", category: "Stone/mineral surfaces", supplier: "Builder stone supplier", range: "Stone/mineral surface", colour: "Supplier quote colour", thickness: "40 mm built-up edge", thicknessConfiguration: "Mitred/built-up edge", priceStatus: "quote_required", sourceUrl: "" },
  { id: "stone-specialty", category: "Stone/mineral surfaces", supplier: "Builder stone supplier", range: "Specialty stone/mineral surface", colour: "Supplier quote colour", thickness: "Specialty", thicknessConfiguration: "Specialty slab/profile by supplier quote", priceStatus: "quote_required", sourceUrl: "" },
];

export const DEFAULT_CABINET_SCHEDULE = [];

export function defaultCabinetryDraft(existing = {}) {
  return normaliseCabinetrySelection({
    workspaceId: existing.workspaceId || "",
    projectId: existing.projectId || "",
    cabinetScheduleId: existing.cabinetScheduleId || "project-cabinetry-schedule",
    cabinetScheduleVersion: existing.cabinetScheduleVersion || "draft",
    scheduleApproved: existing.scheduleApproved ?? false,
    confirmed: Boolean(existing.confirmed),
    activeLocation: existing.activeLocation || "",
    locations: Array.isArray(existing.locations) ? existing.locations : [],
    schedule: Array.isArray(existing.schedule) ? existing.schedule : [],
    audit: [{ action: "created_connected_cabinetry_workflow", at: new Date().toISOString() }],
    ...existing,
  });
}

export function normaliseCabinetrySelection(selection = {}) {
  const migrated = selection?.schemaVersion && Number(selection.schemaVersion) < 2 ? migrateFlattenedCabinetrySelection(selection) : selection;
  const locations = (migrated.locations || []).map((location) => normaliseLocation(location)).filter((location) => location.included);
  const locationNames = new Set(locations.map((location) => location.location));
  const roomSchedule = locations.flatMap((location) => (location.cabinetSchedule || []).map((item) => ({ ...item, location: location.location })));
  const locationByName = new Map(locations.map((location) => [location.location, location]));
  const schedule = normaliseCabinetrySchedule([...(Array.isArray(migrated.schedule) ? migrated.schedule : DEFAULT_CABINET_SCHEDULE), ...roomSchedule])
    .filter((item) => !item.location || locationNames.has(item.location))
    .filter((item) => cabinetryScheduleLineValidForLocation(item, locationByName.get(item.location)));
  const effectiveLocations = locations;
  const handleQuantity = schedule.reduce((sum, item) => sum + numberValue(item.handleQuantity), 0);
  const quoteRequiredItems = [];
  effectiveLocations.forEach((location) => {
    if (/quote|required|pending/i.test(location.benchtop?.priceStatus || "")) quoteRequiredItems.push(`${location.location} benchtop`);
    if (/quote|required|pending/i.test(location.handles?.overhead?.priceStatus || "")) quoteRequiredItems.push(`${location.location} overhead opening method`);
  });
  const confirmed = Boolean(migrated.confirmed);
  const allowance = numberValue(migrated.allowance ?? migrated.summary?.allowance ?? 2500);
  const summary = buildCabinetrySummary(effectiveLocations, schedule, handleQuantity, quoteRequiredItems, migrated.scheduleApproved !== false, confirmed, allowance);
  return {
    selectionType: "cabinetry_specification",
    workflowType: "guided_cabinetry",
    schemaVersion: 2,
    workspaceId: migrated.workspaceId || "",
    projectId: migrated.projectId || "",
    cabinetScheduleId: migrated.cabinetScheduleId || "project-cabinetry-schedule",
    cabinetScheduleVersion: migrated.cabinetScheduleVersion || "draft",
    scheduleApproved: migrated.scheduleApproved !== false,
    confirmed,
    stages: CABINETRY_WORKFLOW_STAGES,
    activeLocation: migrated.activeLocation && locationNames.has(migrated.activeLocation) ? migrated.activeLocation : effectiveLocations[0]?.location || "",
    locations: effectiveLocations,
    schedule,
    pricingTiers: CABINETRY_PRICING_TIERS,
    supplierRecords: supplierVerificationRecords(),
    summary,
    boqLines: buildCabinetryBoqLines(effectiveLocations, schedule),
    cabinetmakerRfq: buildCabinetmakerRfq(effectiveLocations, schedule),
    stoneSupplierRfq: buildStoneSupplierRfq(effectiveLocations),
    procurementSchedule: buildCabinetryProcurement(effectiveLocations, schedule),
    audit: Array.isArray(migrated.audit) ? migrated.audit : [],
    previousCabinetrySelectionsForReview: Array.isArray(migrated.previousCabinetrySelectionsForReview) ? migrated.previousCabinetrySelectionsForReview : [],
    confirmedSnapshot: migrated.confirmedSnapshot || null,
  };
}

export function buildCabinetrySelectionPayload({ workspaceId = "", projectId = "", selection = {}, requirement = {} } = {}) {
  const cabinetrySelection = normaliseCabinetrySelection({ ...selection, workspaceId, projectId });
  const complete = cabinetrySelection.summary.complete;
  const selectedPrice = cabinetrySelection.summary.selectedPrice || null;
  const variation = selectedPrice == null ? null : roundMoney(selectedPrice - cabinetrySelection.summary.allowance);
  const primary = cabinetrySelection.locations[0] || {};
  const imageUrl = primary.defaultColour?.swatchImage || HANDLE_HOUSE_BASE_CATALOGUE[0].imageUrl;
  return {
    id: `cabinetry-${projectId || "project"}`,
    category: "cabinetry",
    room: "Cabinetry",
    title: "Cabinetry",
    selected_product_name: cabinetrySelection.summary.label,
    product_name: cabinetrySelection.summary.label,
    selected_supplier_name: primary.supplier || "Builder Cabinetmaker",
    image_url: imageUrl,
    included_allowance: cabinetrySelection.summary.allowance,
    allowance_amount: cabinetrySelection.summary.allowance,
    client_selection_price: selectedPrice,
    variation_amount: variation,
    selection_status: complete ? "selected" : "in_progress",
    status: complete ? "selected" : "in_progress",
    is_active: true,
    selected_details: {
      source: "guided_client_selections",
      selectionType: "cabinetry_specification",
      workflowType: "guided_cabinetry",
      schemaVersion: 2,
      area: "cabinetry",
      room: "Cabinetry",
      requirementKey: "cabinetry",
      requirementLabel: "Cabinetry",
      familyKey: "cabinetry",
      selectedProduct: cabinetrySelection.summary.label,
      productName: cabinetrySelection.summary.label,
      supplier: primary.supplier || "Builder Cabinetmaker",
      colour: cabinetrySelection.summary.primaryColour,
      finish: cabinetrySelection.summary.primaryFinish,
      allowance: cabinetrySelection.summary.allowance,
      selectedPrice,
      variationAmount: variation,
      variationPending: cabinetrySelection.summary.quoteRequiredItems.length > 0,
      priceState: cabinetrySelection.summary.quoteRequiredItems.length ? "Quote Required" : "Current Price",
      configurationComplete: complete,
      cabinetrySelection,
      previousCabinetrySelectionsForReview: cabinetrySelection.previousCabinetrySelectionsForReview,
      cabinetmakerRfq: cabinetrySelection.cabinetmakerRfq,
      procurementSchedule: cabinetrySelection.procurementSchedule,
      boqLines: cabinetrySelection.boqLines,
      clientPortal: {
        canEditQuantities: false,
        canSaveDraft: true,
        canCompareColours: true,
        canSubmitForBuilderReview: true,
      },
      immutableSnapshot: complete ? createConfirmedCabinetrySnapshot(cabinetrySelection) : null,
    },
    metadata: {
      source: "guided_client_selections",
      selectionType: "cabinetry_specification",
      workflowType: "guided_cabinetry",
      schemaVersion: 2,
      area: "cabinetry",
      requirementKey: "cabinetry",
      familyKey: "cabinetry",
      connectedAliases: CABINETRY_REQUIREMENT_ALIASES,
    },
  };
}

export function createConfirmedCabinetrySnapshot(selection = {}) {
  const normalised = normaliseCabinetrySelection(selection);
  return Object.freeze({
    workspaceId: normalised.workspaceId,
    projectId: normalised.projectId,
    cabinetScheduleId: normalised.cabinetScheduleId,
    cabinetScheduleVersion: normalised.cabinetScheduleVersion,
    locations: normalised.locations.map((location) => ({ ...location })),
    schedule: normalised.schedule.map((item) => ({ ...item })),
    boqLines: normalised.boqLines.map((item) => ({ ...item })),
    cabinetmakerRfq: { ...normalised.cabinetmakerRfq, lines: normalised.cabinetmakerRfq.lines.map((item) => ({ ...item })) },
    stoneSupplierRfq: { ...normalised.stoneSupplierRfq, lines: normalised.stoneSupplierRfq.lines.map((item) => ({ ...item })) },
    procurementSchedule: normalised.procurementSchedule.map((item) => ({ ...item })),
    confirmedAt: new Date().toISOString(),
    revision: normalised.summary.revision,
  });
}

export function copyCabinetryLocation(selection, fromLocation, toLocations = []) {
  const normalised = normaliseCabinetrySelection(selection);
  const source = normalised.locations.find((location) => location.location === fromLocation);
  if (!source) return normalised;
  const sourceSchedule = normalised.schedule.filter((item) => item.location === fromLocation);
  const copiedSchedule = toLocations.flatMap((toLocation) => sourceSchedule.map((item, index) => ({
    ...item,
    componentId: `${item.componentId || "CAB-COPY"}-${slugValue(toLocation)}-${index + 1}`,
    location: toLocation,
    notes: [item.notes, `Copied from ${fromLocation}`].filter(Boolean).join(" - "),
  })));
  return normaliseCabinetrySelection({
    ...normalised,
    locations: normalised.locations.map((location) => toLocations.includes(location.location) ? { ...source, id: location.id, name: location.name, location: location.location, locationType: location.locationType, status: "in_progress", confirmedAt: "", source: `copied_from_${fromLocation}` } : location),
    schedule: [
      ...normalised.schedule.filter((item) => !toLocations.includes(item.location)),
      ...copiedSchedule,
    ],
    audit: [...normalised.audit, { action: "copy_location_selections", fromLocation, toLocations, at: new Date().toISOString() }],
  });
}

export const CABINETRY_COPY_SECTION_KEYS = [
  "scope",
  "schedule",
  "doorsPanels",
  "coloursFinishes",
  "benchtops",
  "handles",
  "features",
  "notesSupplier",
];

export function copyCabinetryLocationSections(selection, {
  fromLocation,
  toLocation,
  sections = CABINETRY_COPY_SECTION_KEYS,
  mode = "replace",
} = {}) {
  const normalised = normaliseCabinetrySelection(selection);
  const source = normalised.locations.find((location) => location.location === fromLocation);
  if (!source || !toLocation) return normalised;
  const selectedSections = new Set(sections.filter((section) => CABINETRY_COPY_SECTION_KEYS.includes(section)));
  if (!selectedSections.size) return normalised;
  const destination = normalised.locations.find((location) => location.location === toLocation);
  const existingDestination = destination || normaliseLocation({ location: toLocation, name: toLocation, included: true, status: "in_progress" });
  const nextDestination = copyCabinetryLocationSectionData(source, existingDestination, selectedSections, mode);
  const scheduleForDestination = copyCabinetryScheduleSection(normalised.schedule, fromLocation, toLocation, selectedSections, mode);
  const locations = destination
    ? normalised.locations.map((location) => location.location === toLocation ? nextDestination : location)
    : [...normalised.locations, nextDestination];
  return normaliseCabinetrySelection({
    ...normalised,
    activeLocation: toLocation,
    locations,
    schedule: [
      ...normalised.schedule.filter((item) => item.location !== toLocation),
      ...scheduleForDestination,
    ],
    audit: [
      ...normalised.audit,
      { action: "copy_location_sections", fromLocation, toLocation, sections: Array.from(selectedSections), mode, at: new Date().toISOString() },
    ],
  });
}

export function kitchenPantryCopiedScheduleLine(item = {}) {
  if (item.location !== "Butler's Pantry") return false;
  const markerText = [
    item.notes,
    item.copyNote,
    item.source,
    item.sourceLocation,
    item.copiedFromLocation,
    item.metadata?.copiedFromLocation,
    item.metadata?.sourceLocation,
  ].filter(Boolean).join(" ");
  return /copied\s+from\s+kitchen|copied_from_kitchen/i.test(markerText);
}

export function cleanIncorrectButlersPantryCopiedScheduleRows(selection) {
  const normalised = normaliseCabinetrySelection(selection);
  const removedRows = normalised.schedule.filter(kitchenPantryCopiedScheduleLine);
  if (!removedRows.length) return normalised;
  return normaliseCabinetrySelection({
    ...normalised,
    locations: normalised.locations.map((location) => location.location === "Butler's Pantry" && /copied\s+from\s+kitchen|copied_from_kitchen/i.test(`${location.source || ""} ${location.copiedFromLocation || ""}`)
      ? { ...location, source: "project_default", copiedFromLocation: "", copiedSelectionsEditable: false, confirmedAt: "", status: "in_progress" }
      : location),
    schedule: normalised.schedule.filter((item) => !kitchenPantryCopiedScheduleLine(item)),
    audit: [
      ...normalised.audit,
      {
        action: "remove_incorrect_kitchen_to_pantry_copied_schedule_rows",
        removedComponentIds: removedRows.map((item) => item.componentId),
        at: new Date().toISOString(),
      },
    ],
  });
}

export function applyKitchenColoursToButlersPantry(selection, {
  areaKeys = [],
  overwrite = false,
  cleanCopiedSchedule = true,
} = {}) {
  const normalised = cleanCopiedSchedule
    ? cleanIncorrectButlersPantryCopiedScheduleRows(selection)
    : normaliseCabinetrySelection(selection);
  const kitchen = normalised.locations.find((location) => location.location === "Kitchen");
  const pantry = normalised.locations.find((location) => location.location === "Butler's Pantry");
  if (!kitchen || !pantry) return normalised;
  const pantryEnabled = new Set(Array.isArray(pantry.enabledAreaKeys) ? pantry.enabledAreaKeys : []);
  const requested = Array.isArray(areaKeys) && areaKeys.length ? areaKeys : Array.from(pantryEnabled);
  const copiedAreaKeys = requested.filter((areaKey) => {
    const source = kitchen.areaSelections?.[areaKey];
    if (!pantryEnabled.has(areaKey) || !plainObject(source)) return false;
    if (!overwrite && plainObject(pantry.areaSelections?.[areaKey]) && cabinetryAreaHasFinish(pantry.areaSelections[areaKey])) return false;
    return true;
  });
  if (!copiedAreaKeys.length) return normalised;
  const areaSelections = { ...(pantry.areaSelections || {}) };
  copiedAreaKeys.forEach((areaKey) => {
    areaSelections[areaKey] = deepClone(kitchen.areaSelections[areaKey]);
  });
  const nextPantry = {
    ...pantry,
    status: "in_progress",
    confirmedAt: "",
    source: pantry.source || "project_default",
    areaSelections,
    supplier: pantry.supplier || kitchen.supplier,
    productRange: pantry.productRange || kitchen.productRange,
    finish: pantry.finish || kitchen.finish,
    defaultColour: pantry.defaultColour || copiedAreaKeys.map((key) => areaSelections[key]).find(Boolean) || null,
    coloursAndFinishes: {
      ...(pantry.coloursAndFinishes || {}),
      areaSelections,
      kitchenColourSource: "Kitchen",
      kitchenColourAppliedAt: new Date().toISOString(),
      kitchenColourAppliedAreaKeys: copiedAreaKeys,
    },
  };
  return normaliseCabinetrySelection({
    ...normalised,
    locations: normalised.locations.map((location) => location.location === "Butler's Pantry" ? nextPantry : location),
    audit: [
      ...normalised.audit,
      {
        action: "apply_kitchen_colours_to_butlers_pantry",
        copiedAreaKeys,
        overwrite,
        at: new Date().toISOString(),
      },
    ],
  });
}

function copyCabinetryLocationSectionData(source, destination, sections, mode) {
  const next = deepClone(destination);
  const shouldCopy = (section, complete) => sections.has(section) && (mode !== "incomplete" || !complete);
  if (shouldCopy("scope", Array.isArray(destination.enabledAreaKeys) && destination.enabledAreaKeys.length > 0)) {
    next.enabledAreaKeys = deepClone(source.enabledAreaKeys || []);
    next.scope = deepClone(source.scope || source.enabledAreaKeys || []);
  }
  if (shouldCopy("doorsPanels", Boolean(destination.doorMaterialGroup || destination.doorAndPanelSelections?.material))) {
    next.doorMaterialGroup = source.doorMaterialGroup;
    next.doorAndPanelSelections = deepClone(source.doorAndPanelSelections);
    next.edgeDetail = source.edgeDetail;
  }
  if (shouldCopy("coloursFinishes", Object.values(destination.areaSelections || {}).some(Boolean))) {
    next.supplier = source.supplier;
    next.productRange = source.productRange;
    next.finish = source.finish;
    next.defaultColour = deepClone(source.defaultColour);
    next.areaSelections = deepClone(source.areaSelections || {});
    next.coloursAndFinishes = deepClone(source.coloursAndFinishes || {});
    next.bulkheadFinishMode = source.bulkheadFinishMode || "";
    next.kickPanelFinishMode = source.kickPanelFinishMode || "";
  }
  if (shouldCopy("benchtops", Boolean(destination.benchtop || destination.benchtops))) {
    next.benchtop = deepClone(source.benchtop || null);
    next.benchtops = deepClone(source.benchtops || source.benchtop || null);
    next.benchtopEdge = source.benchtopEdge || "";
    next.benchtopUpstand = source.benchtopUpstand || "";
    next.benchtopDimensions = source.benchtopDimensions || "";
  }
  if (shouldCopy("handles", Boolean(destination.handles?.base || destination.handles?.overhead))) {
    next.handles = deepClone(source.handles || {});
  }
  if (shouldCopy("features", Boolean((destination.featureOptions || destination.features || []).length))) {
    next.features = deepClone(source.features || source.featureOptions || []);
    next.featureOptions = deepClone(source.featureOptions || source.features || []);
    next.integratedAppliances = deepClone(source.integratedAppliances || []);
  }
  if (shouldCopy("notesSupplier", Boolean(destination.notes || destination.customSupplier || destination.customRange || destination.customColour || destination.customFinish))) {
    next.notes = source.notes || "";
    next.customSupplier = source.customSupplier || "";
    next.customRange = source.customRange || "";
    next.customProfile = source.customProfile || "";
    next.customMaterial = source.customMaterial || "";
    next.customColour = source.customColour || "";
    next.customFinish = source.customFinish || "";
    next.customDescription = source.customDescription || "";
    next.customReferenceImage = source.customReferenceImage || "";
  }
  return {
    ...next,
    id: destination.id || `cabinetry-${slugValue(destination.location || destination.name)}`,
    name: destination.name || destination.location,
    location: destination.location || destination.name,
    locationType: destination.locationType || destination.location || destination.name,
    status: "in_progress",
    confirmedAt: "",
    source: `copied_from_${source.location}`,
    copiedFromLocation: source.location,
    copiedSelectionsEditable: true,
  };
}

function copyCabinetryScheduleSection(schedule, fromLocation, toLocation, sections, mode) {
  const existing = schedule.filter((item) => item.location === toLocation);
  if (!sections.has("schedule")) return existing;
  if (mode === "incomplete" && existing.length) return existing;
  return schedule.filter((item) => item.location === fromLocation).map((item, index) => ({
    ...deepClone(item),
    componentId: `${item.componentId || "CAB-COPY"}-${slugValue(toLocation)}-${index + 1}`,
    location: toLocation,
    notes: [item.notes, `Copied from ${fromLocation}`].filter(Boolean).join(" - "),
  }));
}

function deepClone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

export function overrideCabinetryArea(selection, locationName, areaKey, colour) {
  const normalised = normaliseCabinetrySelection(selection);
  return normaliseCabinetrySelection({
    ...normalised,
    locations: normalised.locations.map((location) => location.location === locationName ? {
      ...location,
      source: "individual_location_override",
      areaSelections: { ...location.areaSelections, [areaKey]: colour },
    } : location),
    audit: [...normalised.audit, { action: "create_area_override", location: locationName, areaKey, colourCode: colour?.colourCode || colour?.productCode || "", at: new Date().toISOString() }],
  });
}

function normaliseLocation(location = {}) {
  const name = location.name || location.location || "Kitchen";
  const wetArea = isWetAreaCabinetryLocationName(name);
  const sourceAreaSelections = plainObject(location.areaSelections) ? location.areaSelections : {};
  const migratedWetAreaSelections = wetArea ? migrateLegacyWetAreaSelections(sourceAreaSelections) : sourceAreaSelections;
  const coloursAndFinishes = plainObject(location.coloursAndFinishes) ? location.coloursAndFinishes : {};
  const coloursAndFinishesAreaSelections = plainObject(coloursAndFinishes.areaSelections) ? coloursAndFinishes.areaSelections : {};
  const defaultColour = plainObject(location.defaultColour)
    ? location.defaultColour
    : plainObject(sourceAreaSelections.lowerDoorsDrawers)
      ? sourceAreaSelections.lowerDoorsDrawers
      : plainObject(coloursAndFinishes.defaultColour)
        ? coloursAndFinishes.defaultColour
        : null;
  const hasExplicitAreaSelections = CABINETRY_AREA_KEYS.some((key) => plainObject(sourceAreaSelections[key]) || plainObject(coloursAndFinishesAreaSelections[key]));
  const bulkheadFinishMode = location.bulkheadFinishMode || coloursAndFinishes.bulkheadFinishMode || location.areaSelections?.bulkheads?.finishMode || "";
  const kickPanelFinishMode = location.kickPanelFinishMode || coloursAndFinishes.kickPanelFinishMode || location.areaSelections?.kickPanels?.finishMode || "";
  const bathroomScopeKeys = Array.isArray(location.bathroomScopeKeys)
    ? location.bathroomScopeKeys.filter(Boolean)
    : Array.isArray(location.bathroomScope)
      ? location.bathroomScope.filter(Boolean)
      : wetArea
        ? inferWetAreaScopeKeys(location)
        : [];
  const areaSelections = Object.fromEntries(CABINETRY_AREA_KEYS.map((key) => {
    const selected = plainObject(migratedWetAreaSelections[key])
      ? migratedWetAreaSelections[key]
      : plainObject(coloursAndFinishesAreaSelections[key])
        ? coloursAndFinishesAreaSelections[key]
        : !hasExplicitAreaSelections && key === "lowerDoorsDrawers"
          ? defaultColour
          : fallbackCabinetryAreaSelection(key, { bulkheadFinishMode, kickPanelFinishMode });
    return [key, selected || null];
  }));
  const enabledAreaKeys = normaliseEnabledAreaKeys({ ...location, location: name, enabledAreaKeys: location.enabledAreaKeys || location.scope }, wetArea);
  const cabinetSchedule = Array.isArray(location.cabinetSchedule)
    ? normaliseCabinetrySchedule(location.cabinetSchedule.map((item) => ({ ...item, location: name }))).filter((item) => cabinetryScheduleLineValidForLocation(item, { location: name }))
    : [];
  return {
    id: location.id || `cabinetry-${slugValue(name)}`,
    name,
    location: name,
    locationType: location.locationType || name,
    included: location.included !== false,
    status: location.status || (location.confirmedAt ? "complete" : "in_progress"),
    required: location.required !== false,
    source: location.source || "project_default",
    copiedFromLocation: location.copiedFromLocation || "",
    copiedSelectionsEditable: Boolean(location.copiedSelectionsEditable),
    scope: enabledAreaKeys,
    bathroomScopeKeys,
    bathroomScope: bathroomScopeKeys,
    cabinetSchedule,
    doorAndPanelSelections: location.doorAndPanelSelections || { material: location.doorMaterialGroup || "Standard colourboard" },
    coloursAndFinishes: Object.keys(coloursAndFinishes).length ? { ...coloursAndFinishes, areaSelections } : { supplier: location.supplier || defaultColour?.supplier || "Polytec", productRange: location.productRange || defaultColour?.productRange || defaultColour?.productFamily || defaultColour?.range || "", finish: location.finish || defaultColour?.finish || "", areaSelections },
    bulkheadFinishMode,
    kickPanelFinishMode,
    doorMaterialGroup: location.doorMaterialGroup || location.doorAndPanelSelections?.material || "Standard colourboard",
    supplier: location.supplier || location.coloursAndFinishes?.supplier || defaultColour?.supplier || "Polytec",
    productRange: location.productRange || location.coloursAndFinishes?.productRange || defaultColour?.productRange || defaultColour?.productFamily || defaultColour?.range || "",
    finish: location.finish || defaultColour?.finish || "",
    customRange: location.customRange || "",
    customProfile: location.customProfile || "",
    customMaterial: location.customMaterial || "",
    customColour: location.customColour || "",
    customFinish: location.customFinish || "",
    customSupplier: location.customSupplier || "",
    customDescription: location.customDescription || "",
    customReferenceImage: location.customReferenceImage || "",
    defaultColour: defaultColour || null,
      areaSelections,
      benchtopDimensions: location.benchtopDimensions || "",
    enabledAreaKeys,
    edgeDetail: location.edgeDetail || "Matching ABS edge",
    benchtop: location.benchtop || location.benchtops || null,
    benchtops: location.benchtops || location.benchtop || null,
    bathroomBenchtops: plainObject(location.bathroomBenchtops) ? location.bathroomBenchtops : {},
    benchtopEdge: location.benchtopEdge || "",
    benchtopUpstand: location.benchtopUpstand || "",
    handles: location.handles || {},
    bathroomHandles: plainObject(location.bathroomHandles) ? location.bathroomHandles : {},
    integratedAppliances: Array.isArray(location.integratedAppliances) ? location.integratedAppliances : [],
    features: Array.isArray(location.features) ? location.features : Array.isArray(location.featureOptions) ? location.featureOptions : [],
    featureOptions: Array.isArray(location.featureOptions) ? location.featureOptions : Array.isArray(location.features) ? location.features : [],
    notes: location.notes || "",
    confirmedAt: location.confirmedAt || "",
  };
}

function fallbackCabinetryAreaSelection(areaKey, modes = {}) {
  if (areaKey === "bulkheads") {
    if (modes.bulkheadFinishMode === "raw_mdf_wall_paint" || modes.bulkheadFinishMode === "wall_paint") return {
      id: "bulkheads-raw-mdf-wall-paint",
      areaKey,
      material: "Raw MDF",
      finalFinish: "Painted",
      paintSource: "match_wall_colour",
      colourName: "Painted to match walls",
      finish: "Painted to match walls",
      supplier: "",
      productRange: "Painted bulkhead",
      priceStatus: "supplier_quote_required",
      finishMode: "raw_mdf_wall_paint",
      procurementDescription: "Supply and install Raw MDF bulkheads, prepared and painted to match internal wall colour.",
      scheduleDescription: "Supply and install Raw MDF bulkheads, prepared and painted to match internal wall colour.",
    };
    if (modes.bulkheadFinishMode === "raw_mdf_ceiling_paint" || modes.bulkheadFinishMode === "ceiling_paint") return {
      id: "bulkheads-raw-mdf-ceiling-paint",
      areaKey,
      material: "Raw MDF",
      finalFinish: "Painted",
      paintSource: "match_ceiling_colour",
      colourName: "Painted to match ceiling",
      finish: "Painted to match ceiling",
      supplier: "",
      productRange: "Painted bulkhead",
      priceStatus: "supplier_quote_required",
      finishMode: "raw_mdf_ceiling_paint",
      procurementDescription: "Supply and install Raw MDF bulkheads, prepared and painted to match ceiling colour.",
      scheduleDescription: "Supply and install Raw MDF bulkheads, prepared and painted to match ceiling colour.",
    };
  }
  if (areaKey === "kickPanels" && modes.kickPanelFinishMode === "brushed_aluminium") return {
    id: "kick-panels-brushed-aluminium",
    areaKey,
    material: "Aluminium",
    finalFinish: "Brushed aluminium",
    colourName: "Natural aluminium",
    finish: "Brushed aluminium",
    supplier: "",
    productRange: "Metal kick panel",
    priceStatus: "included",
    finishMode: "brushed_aluminium",
    procurementDescription: "Supply and install brushed aluminium kick panels.",
    scheduleDescription: "Supply and install brushed aluminium kick panels.",
  };
  return null;
}

function plainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function migrateLegacyWetAreaSelections(areaSelections = {}) {
  const next = { ...areaSelections };
  if (!plainObject(next.floorVanityDoors) && plainObject(areaSelections.lowerDoorsDrawers)) next.floorVanityDoors = { ...areaSelections.lowerDoorsDrawers, areaKey: "floorVanityDoors" };
  if (!plainObject(next.wallVanityDoors) && plainObject(areaSelections.overheadDoors)) next.wallVanityDoors = { ...areaSelections.overheadDoors, areaKey: "wallVanityDoors" };
  if (!plainObject(next.tallLinenEndPanels) && plainObject(areaSelections.endPanels)) next.tallLinenEndPanels = { ...areaSelections.endPanels, areaKey: "tallLinenEndPanels" };
  return next;
}

function inferWetAreaScopeKeys(location = {}) {
  const enabled = new Set(Array.isArray(location.enabledAreaKeys) ? location.enabledAreaKeys : Array.isArray(location.scope) ? location.scope : []);
  const scopes = [];
  if (enabled.has("lowerDoorsDrawers") || enabled.has("floorVanityDoors") || enabled.has("floorVanityDrawers") || enabled.has("floorVanityTowelDisplay")) scopes.push("floorMountedVanity");
  if (enabled.has("overheadDoors") || enabled.has("wallVanityDoors") || enabled.has("wallVanityDrawers") || enabled.has("wallVanityTowelDisplay")) scopes.push("wallMountedVanity");
  if (enabled.has("endPanels") || enabled.has("tallLinenDoors") || enabled.has("tallLinenEndPanels")) scopes.push("tallLinenCupboard");
  if (enabled.has("linenBulkhead")) scopes.push("linenBulkhead");
  if (enabled.has("bathroomOtherCustom")) scopes.push("otherBathroomCabinetry");
  return scopes;
}

function slugValue(value = "") {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "room";
}

function migrateFlattenedCabinetrySelection(selection = {}) {
  const priorLocations = Array.isArray(selection.locations) ? selection.locations.filter((location) => {
    if (!location) return false;
    const hasUserData = Boolean(
      location.source === "individual_location_override" ||
      location.confirmedAt ||
      location.notes ||
      location.customColour ||
      location.customMaterial ||
      location.customProfile ||
      (Array.isArray(location.featureOptions) && location.featureOptions.length) ||
      (Array.isArray(location.features) && location.features.length)
    );
    return hasUserData || String(location.location || location.name || "").toLowerCase() === "kitchen";
  }) : [];
  const kitchenSource = priorLocations.find((location) => String(location.location || location.name || "").toLowerCase() === "kitchen") || priorLocations[0] || {};
  const legacySchedule = Array.isArray(selection.schedule) ? selection.schedule.filter((item) => String(item.location || "").toLowerCase() === "kitchen") : [];
  if (!Object.keys(kitchenSource).length && !legacySchedule.length) return { ...selection, schemaVersion: 2, locations: [], schedule: [] };
  return {
    ...selection,
    schemaVersion: 2,
    activeLocation: "Kitchen",
    locations: [{
      ...kitchenSource,
      id: kitchenSource.id || "cabinetry-kitchen",
      name: "Kitchen",
      location: "Kitchen",
      locationType: "Kitchen",
      included: true,
      status: selection.confirmed ? "complete" : "in_progress",
      notes: [kitchenSource.notes, "Migrated from the previous flattened cabinetry record. Review before confirming."].filter(Boolean).join(" "),
    }],
    schedule: legacySchedule.map((item) => ({ ...item, location: "Kitchen" })),
    audit: [
      ...(Array.isArray(selection.audit) ? selection.audit : []),
      { action: "migrated_flattened_cabinetry_to_schema_v2_kitchen_only", at: new Date().toISOString() },
    ],
  };
}

function normaliseCabinetrySchedule(schedule = []) {
  return schedule.map((item, index) => {
    const quantity = Math.max(0, numberValue(item.quantity) || 0);
    return {
      componentId: item.componentId || `CAB-CUSTOM-${index + 1}`,
      location: item.location || "Kitchen",
      type: item.type || item.scheduleType || "",
      unitType: item.unitType || item.type || CABINETRY_SCHEDULE_TYPE_OPTIONS[0],
      quantity,
      width: item.width || "",
      doorDrawerCount: item.doorDrawerCount ?? "",
      planReference: item.planReference || "",
      includedStatus: item.includedStatus || "builder_defined_in_scope",
      clientSelectableSurfaces: Array.isArray(item.clientSelectableSurfaces) ? item.clientSelectableSurfaces : ["lowerDoorsDrawers"],
      handleQuantity: Math.max(0, numberValue(item.handleQuantity ?? quantity) || 0),
      notes: item.notes || "",
    };
  });
}

function normaliseEnabledAreaKeys(location = {}, wetArea = isWetAreaCabinetryLocationName(location.location || location.name)) {
  const allowedKeys = wetArea ? WET_AREA_CABINETRY_AREA_KEYS : CABINETRY_AREA_KEYS;
  if (Array.isArray(location.enabledAreaKeys) && location.enabledAreaKeys.length) {
    return location.enabledAreaKeys.filter((key) => allowedKeys.includes(key));
  }
  if (Array.isArray(location.scope)) return location.scope.filter((key) => allowedKeys.includes(key));
  return [];
}

function cabinetryLocationMissingBenchtop(location = {}) {
  const scope = Array.isArray(location.bathroomScopeKeys) ? location.bathroomScopeKeys : [];
  if (isWetAreaCabinetryLocationName(location.location)) {
    const benchtops = plainObject(location.bathroomBenchtops) ? location.bathroomBenchtops : {};
    if (scope.includes("floorMountedVanity") && !cabinetryAreaHasFinish(benchtops.floorMountedVanity)) return true;
    if (scope.includes("wallMountedVanity") && !cabinetryAreaHasFinish(benchtops.wallMountedVanity)) return true;
    return false;
  }
  return !location.benchtop;
}

function cabinetryLocationMissingHandles(location = {}) {
  const scope = Array.isArray(location.bathroomScopeKeys) ? location.bathroomScopeKeys : [];
  if (isWetAreaCabinetryLocationName(location.location)) {
    const handles = plainObject(location.bathroomHandles) ? location.bathroomHandles : {};
    const required = ["floorMountedVanity", "wallMountedVanity", "tallLinenCupboard", "mirroredShavingCabinet"].filter((key) => scope.includes(key));
    return required.some((key) => !cabinetryAreaHasFinish(handles[key]));
  }
  return !location.handles?.base;
}

function buildCabinetrySummary(locations, schedule, handleQuantity, quoteRequiredItems, scheduleApproved, confirmed, allowance = 2500) {
  const first = locations[0] || {};
  const primaryColour = first.areaSelections?.lowerDoorsDrawers?.colourName || first.defaultColour?.colourName || "No colour selected";
  const benchtop = first.benchtop?.thickness ? `${first.benchtop.range} ${first.benchtop.thickness}` : first.benchtop?.range || "No benchtop selected";
  const handle = first.handles?.base?.productName || "No handle selected";
  const unresolved = locations.filter((location) => !location.confirmedAt && (!location.enabledAreaKeys?.length || incompleteCabinetryColourAreas(location).length || cabinetryLocationMissingBenchtop(location) || cabinetryLocationMissingHandles(location))).map((location) => location.location);
  const completeRoomCount = locations.filter((location) => location.status === "complete" || location.confirmedAt).length;
  const status = !locations.length ? "not_started" : unresolved.length || completeRoomCount < locations.length ? "in_progress" : "complete";
  return {
    label: locations.length ? `${completeRoomCount} of ${locations.length} rooms complete` : "No cabinetry rooms added",
    supplier: first.supplier || "",
    primaryColour,
    primaryFinish: first.areaSelections?.lowerDoorsDrawers?.finish || first.finish || "",
    benchtop,
    handle,
    handleQuantity,
    scheduleLineCount: schedule.length,
    locationCount: locations.length,
    includedRoomCount: locations.length,
    completeRoomCount,
    status,
    allowance,
    selectedPrice: null,
    variation: null,
    quoteRequiredItems,
    colourIncompleteAreas: Object.fromEntries(locations.map((location) => [location.location, incompleteCabinetryColourAreas(location)])),
    unresolvedLocations: unresolved,
    readyToConfirm: Boolean(locations.length) && scheduleApproved && !unresolved.length,
    complete: Boolean(locations.length) && (status === "complete" || Boolean(confirmed) && scheduleApproved && !unresolved.length),
    revision: `cabinetry-${new Date().toISOString()}`,
  };
}

function incompleteCabinetryColourAreas(location = {}) {
  const enabled = Array.isArray(location.enabledAreaKeys) ? location.enabledAreaKeys.filter((key) => CABINETRY_AREA_KEYS.includes(key)) : [];
  return enabled.filter((areaKey) => !cabinetryAreaHasFinish(location.areaSelections?.[areaKey]));
}

function cabinetryAreaHasFinish(selection) {
  if (!plainObject(selection)) return false;
  if (selection.finishMode && selection.finishMode !== "cabinetry_colour") return true;
  return Boolean(selection.id || selection.colourId || selection.colourName || selection.finish || selection.productRange || selection.productFamily);
}

function isWetAreaCabinetryLocationName(locationName = "") {
  return WET_AREA_CABINETRY_ROOM_NAMES.includes(String(locationName || "").trim().toLowerCase());
}

function cabinetryScheduleLineValidForLocation(item = {}, location = {}) {
  if (!location || !item) return false;
  const type = item.type || item.unitType || "";
  if (isWetAreaCabinetryLocationName(location.location || location.name || item.location)) {
    return WET_AREA_CABINETRY_SCHEDULE_TYPES.includes(type);
  }
  return !WET_AREA_CABINETRY_SCHEDULE_TYPES.includes(type);
}

function buildCabinetryBoqLines(locations, schedule) {
  const cabinetryLines = schedule.flatMap((item) => {
    const location = locations.find((entry) => entry.location === item.location) || locations[0] || {};
    const colour = location.areaSelections?.[item.clientSelectableSurfaces?.[0]] || location.defaultColour || {};
    const baseLine = {
      sourceSelectionId: "cabinetry",
      location: item.location,
      componentId: item.componentId,
      itemName: `${item.location} ${item.unitType}`,
      quantity: item.quantity,
      unit: "ITEM",
      supplier: colour.supplier || location.supplier,
      productRange: colour.productRange || colour.productFamily || location.productRange,
      colourName: colour.colourName,
      colourCode: colour.colourCode,
      finish: colour.finish,
      swatchImage: colour.swatchImage || colour.swatchThumbnail || "",
      officialProductUrl: colour.officialProductUrl || colour.sourceUrl || "",
      edge: location.edgeDetail,
      priceStatus: colour.priceStatus || "price_pending",
      variation: null,
    };
    const handle = location.handles?.base;
    const handleLine = handle ? {
      sourceSelectionId: "cabinetry",
      location: item.location,
      componentId: `${item.componentId}-handle`,
      itemName: `${item.location} handles - ${handle.productName}`,
      quantity: item.handleQuantity,
      unit: "EACH",
      supplier: "Handle House",
      productRange: handle.style,
      colourName: handle.selectedFinish,
      colourCode: handle.productCode,
      finish: handle.selectedFinish,
      edge: handle.openingMethod,
      priceStatus: "price_pending",
      variation: null,
    } : null;
    return [baseLine, handleLine].filter(Boolean);
  });
  const benchtopLines = locations.map(stoneBenchtopToBoqLine).filter(Boolean);
  return [...cabinetryLines, ...buildCabinetryAreaSpecificationLines(locations), ...benchtopLines];
}

function buildCabinetmakerRfq(locations, schedule) {
  const areaSpecifications = buildCabinetryAreaSpecificationLines(locations);
  return {
    generatedFrom: "client_selections_cabinetry",
    status: "ready_for_builder_review",
    areaSpecifications,
    lines: schedule.map((item) => {
      const location = locations.find((entry) => entry.location === item.location) || locations[0] || {};
      const colour = location.areaSelections?.[item.clientSelectableSurfaces?.[0]] || location.defaultColour || {};
      const handle = location.handles?.base || {};
      return {
        componentId: item.componentId,
        location: item.location,
        unitType: item.unitType,
        quantity: item.quantity,
        width: item.width,
        doorDrawerCount: item.doorDrawerCount,
        planReference: item.planReference,
        material: location.doorMaterialGroup,
        supplier: colour.supplier || location.supplier,
        productRange: colour.productRange || colour.productFamily || location.productRange,
        colour: colour.colourName,
        colourCode: colour.colourCode,
        finish: colour.finish,
        swatchImage: colour.swatchImage || colour.swatchThumbnail || "",
        officialProductUrl: colour.officialProductUrl || colour.sourceUrl || "",
        priceStatus: colour.priceStatus || "price_pending",
        edge: location.edgeDetail,
        benchtop: location.benchtop,
        stoneBenchtop: location.benchtop?.materialChoice === "stone" ? location.benchtop : null,
        handleProduct: handle.productName,
        handleCode: handle.productCode,
        handleQuantity: item.handleQuantity,
        integratedApplianceRequirements: location.integratedAppliances,
        notes: item.notes,
      };
    }),
  };
}

function buildCabinetryAreaSpecificationLines(locations = []) {
  return locations.flatMap((location) => CABINETRY_AREA_KEYS.map((areaKey) => {
    const selection = location.areaSelections?.[areaKey];
    if (!cabinetryAreaIsStandaloneSpecification(selection)) return null;
    return {
      sourceSelectionId: "cabinetry",
      location: location.location,
      componentId: `${location.id || slugValue(location.location)}-${areaKey}`,
      itemName: cabinetryAreaSpecificationDescription(areaKey, selection),
      areaKey,
      cabinetryArea: CABINETRY_AREA_LABELS[areaKey] || areaKey,
      quantity: 1,
      unit: "ITEM",
      material: selection.material || "",
      supplier: selection.supplier || "Cabinetmaker",
      productRange: selection.productRange || "",
      colourName: selection.colourName || "",
      colourCode: selection.colourCode || selection.paintColourCode || "",
      finish: selection.finalFinish || selection.finish || "",
      paintSource: selection.paintSource || "",
      priceStatus: selection.priceStatus || "price_pending",
      heightMm: selection.heightMm || "",
      notes: selection.notes || "",
      specification: cabinetryAreaSpecificationDescription(areaKey, selection),
      variation: null,
    };
  }).filter(Boolean));
}

function cabinetryAreaIsStandaloneSpecification(selection) {
  if (!plainObject(selection)) return false;
  return [
    "raw_mdf_wall_paint",
    "raw_mdf_ceiling_paint",
    "raw_mdf_custom_paint",
    "brushed_aluminium",
    "stainless_steel_look",
    "black_aluminium",
    "match_cabinet_doors",
    "match_overheads",
    "match_floor_vanity",
    "match_wall_vanity",
    "match_tall_linen",
    "other_custom",
  ].includes(selection.finishMode);
}

function cabinetryAreaSpecificationDescription(areaKey, selection = {}) {
  if (["bulkheads", "linenBulkhead"].includes(areaKey) && selection.finishMode === "raw_mdf_wall_paint") return "Supply and install Raw MDF bulkheads, prepared and painted to match internal wall colour.";
  if (["bulkheads", "linenBulkhead"].includes(areaKey) && selection.finishMode === "raw_mdf_ceiling_paint") return "Supply and install Raw MDF bulkheads, prepared and painted to match ceiling colour.";
  if (["bulkheads", "linenBulkhead"].includes(areaKey) && selection.finishMode === "raw_mdf_custom_paint") {
    const paint = [selection.paintBrand, selection.paintRange, selection.paintColourName, selection.paintColourCode, selection.paintSheen].filter(Boolean).join(" ");
    return `Supply and install Raw MDF bulkheads, prepared and painted${paint ? ` ${paint}` : " to custom selected paint colour"}.`;
  }
  if (areaKey === "kickPanels" && selection.finishMode === "brushed_aluminium") return "Supply and install brushed aluminium kick panels.";
  if (areaKey === "kickPanels" && selection.finishMode === "stainless_steel_look") return "Supply and install stainless-steel look kick panels.";
  if (areaKey === "kickPanels" && selection.finishMode === "black_aluminium") return "Supply and install black aluminium kick panels.";
  if (areaKey === "kickPanels" && selection.finishMode === "match_cabinet_doors") return "Supply and install kick panels to match cabinet doors.";
  if (areaKey === "bulkheads" && selection.finishMode === "match_overheads") return "Supply and install bulkheads to match overhead cabinetry.";
  if (areaKey === "linenBulkhead" && selection.finishMode === "match_tall_linen") return "Supply and install bulkhead over tall linen cupboard to match tall linen cupboard.";
  return selection.procurementDescription || selection.scheduleDescription || `Supply and install ${CABINETRY_AREA_LABELS[areaKey] || "cabinetry area"} finish as selected.`;
}

function buildCabinetryProcurement(locations, schedule) {
  const lines = buildCabinetryBoqLines(locations, schedule);
  return lines.map((line, index) => ({
    procurementItemId: `cabinetry-proc-${index + 1}`,
    sourceSelectionId: "cabinetry",
    supplier: line.supplier || "Cabinetmaker",
    itemName: line.itemName,
    quantity: line.quantity,
    unit: line.unit,
    estimatedRate: null,
    estimatedTotal: null,
    priceStatus: line.priceStatus,
    orderStatus: "not_started",
    metadata: line,
  }));
}

function scheduleItem(componentId, location, unitType, quantity, width, doorDrawerCount, planReference, clientSelectableSurfaces, handleQuantity) {
  return {
    componentId,
    location,
    unitType,
    quantity,
    width,
    doorDrawerCount,
    planReference,
    includedStatus: "builder_defined_in_scope",
    clientSelectableSurfaces,
    handleQuantity,
    notes: "Builder-defined schedule; client reviews finishes only.",
  };
}

function supplierVerificationRecords() {
  return [
    { supplier: "Laminex", sourceUrl: "https://www.laminex.com.au/browse/product-application/cabinetry-doors-drawers", verifiedDate: "2026-08-31", importedRecords: LAMINEX_CABINETRY_CATALOGUE.length },
    { supplier: "Polytec", sourceUrl: "https://www.polytec.com.au/colours/", verifiedDate: "2026-08-31", importedRecords: POLYTEC_CABINETRY_CATALOGUE.length },
    { supplier: "Handle House", sourceUrl: "https://handlehouse.com.au/collections/cabinet-handles", verifiedDate: "2026-08-30", importedRecords: HANDLE_HOUSE_BASE_CATALOGUE.length },
    { supplier: "Stone benchtops", sourceUrl: "https://www.caesarstone.com.au/colours/", verifiedDate: "2026-08-31", importedRecords: "See STONE_BENCHTOP_CATALOGUE" },
  ];
}
