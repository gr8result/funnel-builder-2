import { canonicalProjectRoomName } from './projectRoomModel.js';
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
  PRODUCT_LIBRARY_LAUNDRY_CABINETRY_SCHEDULE_GROUPS,
  PRODUCT_LIBRARY_LAUNDRY_CABINETRY_SCHEDULE_TYPE_OPTIONS,
  PRODUCT_LIBRARY_CABINETRY_WORKFLOW_STAGES,
  PRODUCT_LIBRARY_HANDLE_HOUSE_CATALOGUE,
  PRODUCT_LIBRARY_WET_AREA_CABINETRY_AREA_KEYS,
  PRODUCT_LIBRARY_WET_AREA_CABINETRY_CONFIG,
  PRODUCT_LIBRARY_WET_AREA_CABINETRY_ROOM_NAMES,
  PRODUCT_LIBRARY_WET_AREA_CABINETRY_SCHEDULE_TYPES,
} from "../product-library/cabinetryCatalogueSelectors.js";
import { buildStoneSupplierRfq, stoneBenchtopToBoqLine } from "./stoneBenchtopWorkflow.js";
import { benchtopFabrication, withThickness } from "./benchtopFabrication.js";
import { bulkheadFinishOption, cabinetryRequirementTypes, cabinetryFinishFor, cabinetryRoomGroup, cabinetryRoomKey, cabinetryTypeCategory, cabinetryVariantIdentity, cabinetScheduleMeasure, legacyCabinetryScheduleType, migrateCabinetSchedule } from "../construction-estimation/cabinetryRequirements.js";

export { LAMINEX_CABINETRY_CATALOGUE, POLYTEC_CABINETRY_CATALOGUE };

export const CABINETRY_REQUIREMENT_ALIASES = ["cabinetry", "cabinet-finish", "handles", "benchtop", "cabinet-doors", "cabinet-handles", "benchtops"];

export const CABINETRY_WORKFLOW_STAGES = PRODUCT_LIBRARY_CABINETRY_WORKFLOW_STAGES;
export const CABINETRY_LOCATIONS = PRODUCT_LIBRARY_CABINETRY_LOCATION_OPTIONS;
export const CABINETRY_AREA_KEYS = PRODUCT_LIBRARY_CABINETRY_AREA_KEYS;
export const CABINETRY_AREA_LABELS = PRODUCT_LIBRARY_CABINETRY_AREA_LABELS;
export const CABINETRY_LOCATION_AREA_KEYS = PRODUCT_LIBRARY_CABINETRY_LOCATION_AREA_KEYS;
export const CABINETRY_SCHEDULE_TYPE_OPTIONS = PRODUCT_LIBRARY_CABINETRY_SCHEDULE_TYPE_OPTIONS;
export const LAUNDRY_CABINETRY_SCHEDULE_GROUPS = PRODUCT_LIBRARY_LAUNDRY_CABINETRY_SCHEDULE_GROUPS;
export const LAUNDRY_CABINETRY_SCHEDULE_TYPE_OPTIONS = PRODUCT_LIBRARY_LAUNDRY_CABINETRY_SCHEDULE_TYPE_OPTIONS;
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

// Generic benchtop thickness choices for laminate/custom benchtops, where the catalogue does not
// already constrain thickness to specific manufacturer-verified values (stone/porcelain products
// carry their own verified thicknessOptions and are not affected by this list).
export const CABINETRY_BENCHTOP_THICKNESS_OPTIONS = ["20 mm", "30 mm", "40 mm", "60 mm"];

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

const reportedScheduleMigrations = new Set();

// Two cabinetry rooms must never share one project room identity (17 Nov 2026 defect). A full
// "Copy complete specification" from Butler's Pantry into a Kitchen that had no projectRoomId of its
// own used to copy Butler's Pantry's projectRoomId with everything else. Approval finds a room by
// that identity, so "Confirm and Approve" in Butler's Pantry re-approved the Kitchen (the first
// match), reported success and left Butler's Pantry unapproved. The identity stays with the room it
// names (the project room of that name, else the room whose name it was made from); the other room
// gets its own project room, or none. Its approval was recorded under the shared identity, so that
// identity is remembered (projectRoomIdRepairedFrom) and the approval stands while the room's
// specification is unchanged.
function repairSharedCabinetryRoomIdentities(locations, roomModel = { rooms: [] }) {
  const byId = new Map();
  locations.forEach((location) => { if (location.projectRoomId) byId.set(location.projectRoomId, [...(byId.get(location.projectRoomId) || []), location]); });
  const shared = [...byId.entries()].filter(([, group]) => group.length > 1);
  if (!shared.length) return locations;
  const rooms = (roomModel?.rooms || []).filter((room) => !room.removed);
  const used = new Set(locations.map((location) => location.projectRoomId).filter(Boolean));
  const replacement = new Map();
  for (const [id, group] of shared) {
    const named = rooms.find((room) => room.id === id)?.name;
    const owner = group.find((location) => named && location.location === named)
      || group.find((location) => String(id).toLowerCase().endsWith(slugValue(location.location)))
      || group[0];
    for (const location of group) {
      if (location === owner) continue;
      const own = rooms.filter((room) => room.name === location.location && !used.has(room.id));
      const nextId = own.length === 1 ? own[0].id : "";
      if (nextId) used.add(nextId);
      replacement.set(location, { ...location, projectRoomId: nextId, projectRoomIdRepairedFrom: id });
    }
  }
  return locations.map((location) => replacement.get(location) || location);
}

export function normaliseCabinetrySelection(selection = {}, roomModel = { rooms: [] }) {
  // Stable location IDs retain the original room key after a display-name rename.
  // An explicit project room model takes precedence; ambiguous IDs are left for review.
  const resolveRoom = name => {
    const explicit = canonicalProjectRoomName(name, roomModel);
    if (explicit !== name) return explicit;
    const key = `cabinetry-${slugValue(name)}`;
    const matches = (selection.locations || []).filter(location => location.id === key);
    return matches.length === 1 ? matches[0].location || matches[0].name : name;
  };
  selection = { ...selection,
    ...(Array.isArray(selection.schedule) ? { schedule: selection.schedule.map(line => ({ ...line, location: resolveRoom(line.location) })) } : {}),
    ...(Array.isArray(selection.legacyCabinetSchedule) ? { legacyCabinetSchedule: selection.legacyCabinetSchedule.map(line => ({ ...line, location: resolveRoom(line.location) })) } : {}),
  };
  const migrated = selection?.schemaVersion && Number(selection.schemaVersion) < 2 ? migrateFlattenedCabinetrySelection(selection) : selection;
  const canonicalLocations = new Map();
  (migrated.locations || []).map((location) => normaliseLocation(location)).filter((location) => location.included).forEach((location) => {
    const originalName = location.location || location.name;
    const canonicalName = canonicalProjectRoomName(originalName, roomModel);
    const canonicalKey = String(canonicalName || "").trim().toLowerCase();
    const projectRoomMatches = (roomModel?.rooms || []).filter(room => !room.removed && room.name === canonicalName);
    const candidate = {
      ...location,
      location: canonicalName,
      projectRoomId: location.projectRoomId || (projectRoomMatches.length === 1 ? projectRoomMatches[0].id : ""),
      ...(location.name ? { name: canonicalName } : {}),
      ...(Array.isArray(location.cabinetSchedule) ? {
        cabinetSchedule: location.cabinetSchedule.map((line) => ({ ...line, location: canonicalName })),
      } : {}),
    };
    const existing = canonicalLocations.get(canonicalKey);
    if (!existing) {
      canonicalLocations.set(canonicalKey, { value: candidate, exact: originalName === canonicalName });
      return;
    }
    const candidateExact = originalName === canonicalName;
    const preferred = candidateExact || !existing.exact ? candidate : existing.value;
    const fallback = preferred === candidate ? existing.value : candidate;
    const lineIds = new Set();
    const cabinetSchedule = [...(preferred.cabinetSchedule || []), ...(fallback.cabinetSchedule || [])].filter((line) => {
      const id = line.componentId || `${line.unitType || line.type}|${Number(line.quantity) || 0}`;
      if (lineIds.has(id)) return false;
      lineIds.add(id);
      return true;
    });
    canonicalLocations.set(canonicalKey, {
      exact: existing.exact || candidateExact,
      value: {
        ...fallback,
        ...preferred,
        location: canonicalName,
        ...(preferred.name || fallback.name ? { name: canonicalName } : {}),
        areaSelections: {
          ...(fallback.areaSelections || {}),
          ...Object.fromEntries(Object.entries(preferred.areaSelections || {}).filter(([, value]) => value != null)),
        },
        handles: { ...(fallback.handles || {}), ...(preferred.handles || {}) },
        bathroomBenchtops: { ...(fallback.bathroomBenchtops || {}), ...(preferred.bathroomBenchtops || {}) },
        enabledAreaKeys: [...new Set([...(fallback.enabledAreaKeys || []), ...(preferred.enabledAreaKeys || [])])],
        // Legacy area-key list (read when enabledAreaKeys is absent): keep both rooms' keys when two names merge.
        scope: [...new Set([...(Array.isArray(fallback.scope) ? fallback.scope : []), ...(Array.isArray(preferred.scope) ? preferred.scope : [])])],
        cabinetSchedule,
      },
    });
  });
  const storedLocations = repairSharedCabinetryRoomIdentities([...canonicalLocations.values()].map((entry) => entry.value), roomModel);
  const locationNames = new Set(storedLocations.map((location) => location.location));
  const locations = storedLocations;
  const roomSchedule = locations.flatMap((location) => (location.cabinetSchedule || []).map((item) => ({ ...item, location: location.location })));
  const locationByName = new Map(locations.map((location) => [location.location, location]));
  // Old display-name schedule lines are brought onto the canonical cabinet items here, so the
  // schedule a user sees and saves only ever holds current items. Lines that cannot be mapped
  // without guessing leave the schedule and are kept whole in legacyCabinetSchedule.
  const allSchedule = normaliseCabinetrySchedule([...(Array.isArray(migrated.schedule) ? migrated.schedule : DEFAULT_CABINET_SCHEDULE), ...roomSchedule]).map((item) => {
    if (!item.cabinetTypeId) return item;
    const identity = cabinetryVariantIdentity(item.location, item.cabinetTypeId, { widthMm: item.width, doors: item.doorDrawerCount });
    const finishKey = cabinetryFinishFor(locationByName.get(item.location)?.doorMaterialGroup)?.key || item.selectedFinishKey || '';
    return identity ? { ...item, ...identity, ...(finishKey ? { selectedFinishKey: finishKey } : {}) } : item;
  });
  const validLine = item => locationNames.has(item.location) && cabinetryScheduleLineValidForLocation(item, locationByName.get(item.location));
  const unresolvedSchedule = allSchedule.filter(item => !validLine(item)).map(item => ({ ...item, archiveReason: 'Room or cabinet scope requires review' }));
  const scheduleMigration = migrateCabinetSchedule(allSchedule.filter(validLine));
  scheduleMigration.archived.push(...unresolvedSchedule);
  const schedule = scheduleMigration.schedule.map((item) => {
    if (!item.cabinetTypeId) return item;
    const identity = cabinetryVariantIdentity(item.location, item.cabinetTypeId, { widthMm: item.width, doors: item.doorDrawerCount });
    const finishKey = cabinetryFinishFor(locationByName.get(item.location)?.doorMaterialGroup)?.key || item.selectedFinishKey || '';
    return identity ? { ...item, ...identity, ...(finishKey ? { selectedFinishKey: finishKey } : {}) } : item;
  });
  const archivedIds = new Set((Array.isArray(migrated.legacyCabinetSchedule) ? migrated.legacyCabinetSchedule : []).map((item) => item.componentId));
  const legacyCabinetSchedule = [...(Array.isArray(migrated.legacyCabinetSchedule) ? migrated.legacyCabinetSchedule : []), ...scheduleMigration.archived.filter((item) => !archivedIds.has(item.componentId))];
  const cabinetScheduleMigration = [...(Array.isArray(migrated.cabinetScheduleMigration) ? migrated.cabinetScheduleMigration : []), ...scheduleMigration.migrated];
  // Reported once per distinct migration, to the developer console only.
  const migrationSignature = JSON.stringify([scheduleMigration.migrated.map((item) => item.componentId), scheduleMigration.archived.map((item) => item.componentId)]);
  if ((scheduleMigration.migrated.length || scheduleMigration.archived.length) && !reportedScheduleMigrations.has(migrationSignature)) {
    reportedScheduleMigrations.add(migrationSignature);
    console.info("[Cabinetry] schedule migrated to the current cabinet list", { migrated: scheduleMigration.migrated, archived: scheduleMigration.archived.map((item) => ({ location: item.location, unitType: item.unitType, quantity: item.quantity, reason: item.archiveReason })) });
  }
  // The schedule, not a separate Scope answer, says what cabinetry each room has.
  const effectiveLocations = storedLocations.map((location) => {
    const derived = reconcileVanityMounting(withDerivedCabinetryScope(location, schedule));
    if (derived.reviewApproval && !isCabinetryRoomApproved(derived, schedule, migrated.projectId)) {
      return { ...derived, status: "in_progress", confirmedAt: "" };
    }
    return derived;
  });
  const handleQuantity = schedule.reduce((sum, item) => sum + numberValue(item.handleQuantity), 0);
  const quoteRequiredItems = [];
  effectiveLocations.forEach((location) => {
    if (/quote|required|pending/i.test(location.benchtop?.priceStatus || "")) quoteRequiredItems.push(`${location.location} benchtop`);
    if (/quote|required|pending/i.test(location.handles?.overhead?.priceStatus || "")) quoteRequiredItems.push(`${location.location} overhead opening method`);
  });
  const confirmed = Boolean(migrated.confirmed);
  const allowance = numberValue(migrated.allowance ?? migrated.summary?.allowance ?? 2500);
  const summary = buildCabinetrySummary(effectiveLocations, schedule, handleQuantity, quoteRequiredItems, migrated.scheduleApproved !== false, confirmed, allowance, migrated.summary?.revision || migrated.cabinetScheduleVersion || "draft", migrated.projectId || "");
  return {
    selectionType: "cabinetry_specification",
    workflowType: "guided_cabinetry",
    schemaVersion: 3,
    workspaceId: migrated.workspaceId || "",
    projectId: migrated.projectId || "",
    cabinetScheduleId: migrated.cabinetScheduleId || "project-cabinetry-schedule",
    cabinetScheduleVersion: migrated.cabinetScheduleVersion || "draft",
    scheduleApproved: migrated.scheduleApproved !== false,
    confirmed,
    // Which quotation range each supplier price group belongs to on this job (benchtopSelection.js).
    benchtopClassifications: plainObject(migrated.benchtopClassifications) ? migrated.benchtopClassifications : {},
    stages: CABINETRY_WORKFLOW_STAGES,
    activeLocation: migrated.activeLocation && locationNames.has(migrated.activeLocation) ? migrated.activeLocation : effectiveLocations[0]?.location || "",
    locations: effectiveLocations.map((location) => ({ ...location, cabinetSchedule: scheduleMigration.archived.length || scheduleMigration.migrated.length ? [] : location.cabinetSchedule })),
    schedule,
    // Internal migration records only; no screen reads these.
    ...(legacyCabinetSchedule.length ? { legacyCabinetSchedule } : {}),
    ...(cabinetScheduleMigration.length ? { cabinetScheduleMigration } : {}),
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
    // Builder pricing reviews for cabinetry variations (selectionVariationPricing.js), keyed by task id.
    pricingReviews: plainObject(migrated.pricingReviews) ? migrated.pricingReviews : {},
  };
}

// ---- Scope is derived ---------------------------------------------------------------------------
// The old workflow asked "does this room have overheads?" on a Scope step and then asked for the
// overhead cabinets again on the Cabinet Schedule, so the two could disagree. The schedule is now
// the one source: what a room contains is read from its scheduled quantities.
const WET_SCOPE_KEY_BY_SCHEDULE_TYPE = new Map(PRODUCT_LIBRARY_WET_AREA_CABINETRY_CONFIG.scheduleGroups
  .flatMap((group) => group.items.map(([type, , scopeKey]) => [type, scopeKey || (group.scopeKeys || [])[0]])));
const WET_SCOPE_ORDER = PRODUCT_LIBRARY_WET_AREA_CABINETRY_CONFIG.scopeOptions.map(([key]) => key);

function scheduleLineKind(line = {}) {
  const typeId = line.cabinetTypeId || legacyCabinetryScheduleType(line)?.type || "";
  if (typeId) return cabinetryTypeCategory(typeId);
  return /overhead|rangehood/i.test(line.unitType || "") ? "overhead" : "base";
}

// { hasBaseCabinets, hasOverheadCabinets, hasTallCabinets, hasDrawerUnits, hasEndPanels } for one
// room, from its scheduled quantities. `derived` is false while the room has nothing scheduled on
// the shared cabinet list - an older job's stored scope then still stands, so nothing it already
// chose (an overhead colour picked before overheads could be scheduled) is hidden.
export function cabinetryScheduleScope(location = {}, schedule = []) {
  const name = location.location || location.name;
  const lines = schedule.filter((line) => line.location === name && numberValue(line.quantity) > 0);
  const kinds = new Set(lines.map(scheduleLineKind));
  const wetArea = isWetAreaCabinetryLocationName(name);
  // A room whose only lines were carried over from the old list has not been scheduled on the
  // current one yet (the old list had no overheads to schedule), so its stored answers stand.
  const derived = wetArea ? lines.some((line) => WET_SCOPE_KEY_BY_SCHEDULE_TYPE.has(line.type || line.unitType)) : lines.some((line) => line.cabinetTypeId && !line.migratedFrom);
  const scope = {
    derived,
    hasBaseCabinets: kinds.has("base"),
    hasOverheadCabinets: kinds.has("overhead"),
    hasTallCabinets: kinds.has("tall"),
    hasDrawerUnits: lines.some((line) => /drawer/i.test(line.cabinetTypeId || line.unitType || line.type || "")),
    hasEndPanels: kinds.has("panels"),
  };
  // Areas the schedule decides; the user cannot switch these on or off anywhere else.
  scope.scheduleAreaKeys = wetArea || !derived ? [] : [
    ...(scope.hasBaseCabinets || scope.hasTallCabinets ? ["lowerDoorsDrawers"] : []),
    ...(scope.hasEndPanels ? ["endPanels"] : []),
    ...(scope.hasOverheadCabinets ? ["overheadDoors"] : []),
  ];
  scope.bathroomScopeKeys = wetArea && derived
    ? WET_SCOPE_ORDER.filter((key) => lines.some((line) => WET_SCOPE_KEY_BY_SCHEDULE_TYPE.get(line.type || line.unitType) === key))
    : null;
  return scope;
}

// A vanity changed from wall-mounted to floor-mounted, or back (18 Nov 2026, the owner's Ensuite).
// The room's choices for the vanity it no longer has are carried onto the vanity it has now, where
// that vanity has no real choice of its own: door / drawer / towel-display colours, the vanity
// handle, the benchtop surface and its thickness / basin / drop-front. The old vanity's slots are
// emptied once carried (they are no longer part of the room), its benchtop area is folded into the
// new one so no second benchtop is listed, and nothing the new vanity already has is replaced. A
// stone the room never chose is still asked for. Pure and idempotent: normalising twice is a no-op.
function reconcileVanityMounting(location) {
  if (!isWetAreaCabinetryLocationName(location.location)) return location;
  const scope = Array.isArray(location.bathroomScopeKeys) ? location.bathroomScopeKeys : [];
  const pair = scope.includes("floorMountedVanity") && !scope.includes("wallMountedVanity") ? ["floor", "wall"]
    : scope.includes("wallMountedVanity") && !scope.includes("floorMountedVanity") ? ["wall", "floor"] : null;
  if (!pair) return location;
  const [to, from] = pair;
  const toKey = `${to}MountedVanity`, fromKey = `${from}MountedVanity`;
  const carried = [];
  let next = location;
  // Colours.
  const areaSelections = { ...(location.areaSelections || {}) };
  for (const part of VANITY_PARTS) {
    const fromArea = `${from}Vanity${part}`, toArea = `${to}Vanity${part}`;
    if (!cabinetryAreaHasRealFinish(fromArea, areaSelections[fromArea])) continue;
    if (cabinetryAreaHasRealFinish(toArea, areaSelections[toArea])) continue;
    areaSelections[toArea] = { ...deepClone(areaSelections[fromArea]), areaKey: toArea };
    areaSelections[fromArea] = null;
    carried.push(toArea);
  }
  if (carried.length) {
    next = { ...next, areaSelections, coloursAndFinishes: { ...(next.coloursAndFinishes || {}), areaSelections } };
  }
  // Handle and bathroom benchtop record.
  for (const [field, chosen] of [["bathroomHandles", cabinetryHandleChosen], ["bathroomBenchtops", cabinetryAreaHasFinish]]) {
    const records = plainObject(next[field]) ? next[field] : {};
    if (!chosen(records[fromKey]) || chosen(records[toKey])) continue;
    const { [fromKey]: old, ...rest } = records;
    next = { ...next, [field]: { ...rest, [toKey]: { ...deepClone(old), targetKey: toKey, ...(field === "bathroomBenchtops" ? { targetLabel: `${BATHROOM_SCOPE_LABELS[toKey]} benchtop` } : {}) } } };
    carried.push(field === "bathroomHandles" ? "handles" : "benchtop");
  }
  // Benchtop areas: one vanity benchtop, never two.
  const areas = Array.isArray(next.benchtopAreas) ? next.benchtopAreas : null;
  const oldArea = areas?.find((area) => area?.id === fromKey);
  if (oldArea) {
    const newArea = areas.find((area) => area?.id === toKey);
    const label = `${BATHROOM_SCOPE_LABELS[toKey]} benchtop`;
    const oldFab = plainObject(oldArea.fabrication) ? oldArea.fabrication : {};
    const merged = newArea
      ? { ...newArea,
        surface: plainObject(newArea.surface) ? newArea.surface : (plainObject(oldArea.surface) ? { ...oldArea.surface, applications: [label] } : newArea.surface || null),
        fabrication: { ...oldFab, ...Object.fromEntries(Object.entries(plainObject(newArea.fabrication) ? newArea.fabrication : {}).filter(([, value]) => value !== "" && value != null)) } }
      : { ...oldArea, id: toKey, label, ...(plainObject(oldArea.surface) ? { surface: { ...oldArea.surface, applications: [label] } } : {}) };
    next = { ...next, benchtopAreas: newArea ? areas.filter((area) => area !== oldArea).map((area) => (area === newArea ? merged : area)) : areas.map((area) => (area === oldArea ? merged : area)) };
    carried.push("benchtop area");
  }
  if (!carried.length) return location;
  const enabledAreaKeys = [...new Set((next.enabledAreaKeys || []).map((key) => (key.startsWith(`${from}Vanity`) ? key.replace(`${from}Vanity`, `${to}Vanity`) : key)))];
  return { ...next, enabledAreaKeys, scope: enabledAreaKeys, vanityMountingReconciled: { from: fromKey, to: toKey, carried: [...new Set([...(location.vanityMountingReconciled?.carried || []), ...carried])] } };
}

function withDerivedCabinetryScope(location, schedule) {
  const scope = cabinetryScheduleScope(location, schedule);
  if (!scope.derived) return location;
  if (scope.bathroomScopeKeys) {
    // A bulkhead over the tall linen cupboard was recorded as a scope answer with no schedule
    // line of its own; that answer is kept for as long as the cupboard it sits over is scheduled.
    const keptBulkhead = (location.bathroomScopeKeys || []).includes("linenBulkhead") && scope.bathroomScopeKeys.includes("tallLinenCupboard");
    const keys = WET_SCOPE_ORDER.filter((key) => scope.bathroomScopeKeys.includes(key) || (key === "linenBulkhead" && keptBulkhead));
    return { ...location, bathroomScopeKeys: keys, bathroomScope: keys };
  }
  // Island backs and end panels without a priced panel line stay the user's own choice (Doors &
  // Panels); base-unit doors and overheads follow the schedule.
  const chosen = (location.enabledAreaKeys || []).filter((key) => !["lowerDoorsDrawers", "overheadDoors"].includes(key));
  const enabledAreaKeys = CABINETRY_AREA_KEYS.filter((key) => scope.scheduleAreaKeys.includes(key) || chosen.includes(key));
  return { ...location, enabledAreaKeys, scope: enabledAreaKeys };
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

// A benchtop area copied with a complete specification belongs to the destination room: an area named
// after the source room ("Butler's Pantry benchtop") is renamed for the destination, so Kitchen never
// lists a Butler's Pantry benchtop after a copy (16 Nov 2026 defect). Island and other areas keep
// their own names; lengths stay the builder's measurement.
function benchtopAreasForCopiedRoom(areas, fromLocation, toLocation) {
  if (!Array.isArray(areas)) return areas;
  const fromName = String(fromLocation || "").toLowerCase();
  const defaultFor = (room) => (/laundry/i.test(room) ? "Laundry benchtop" : /pantry/i.test(room) ? "Butler's Pantry benchtop" : "Main benchtop");
  return areas.map((area) => {
    const label = String(area?.label || "");
    const namedAfterSource = fromName && label.toLowerCase().includes(fromName);
    const sourceDefault = label === defaultFor(fromLocation);
    return namedAfterSource || sourceDefault ? { ...area, label: defaultFor(toLocation) } : area;
  });
}

// "Copied from <room>" used to be appended to every copied schedule line's notes, so a Kitchen
// copied from Butler's Pantry listed "Copied from Butler's Pantry" on each Kitchen item (17 Nov 2026
// defect). Copies no longer write it; this strips it from older saved notes wherever notes are
// shown or edited. The copy itself stays in the selection's audit history.
export function cabinetryNotesWithoutCopyProvenance(notes) {
  // Only the generated "Copied from <cabinetry room>" text; a note the client wrote is kept.
  const generated = (part) => /^copied from\s+(.+)$/i.test(part) && /kitchen|pantry|bath|ensuite|powder|laundry|robe|scullery|study|other|room/i.test(part.replace(/^copied from\s+/i, ""));
  return String(notes ?? "").split(/\s+-\s+/).map((part) => part.trim()).filter((part) => part && !generated(part)).join(" - ");
}

// Items a full "Copy complete specification" put into a room from another room (17 Nov 2026). On the
// real job five copies from Butler's Pantry left Butler's Pantry's cabinets, its measured bulkhead run
// and its benchtop area (with Butler's Pantry's length) in the Kitchen, where they were quoted twice.
// They are listed for the builder/client to keep or remove; nothing is removed automatically.
const COPY_NOTE = /(?:^|\s-\s)copied from\s+(.+?)\s*$/i;
export function cabinetryCopiedItems(selection, locationName) {
  const normalised = normaliseCabinetrySelection(selection);
  const location = normalised.locations.find((item) => item.location === locationName);
  if (!location || location.copiedItemsReviewedAt) return { fromLocation: "", lines: [], benchtopAreas: [] };
  const fromOf = (line) => line.copiedFromLocation || String(line.notes || "").match(COPY_NOTE)?.[1] || "";
  const lines = normalised.schedule.filter((line) => line.location === locationName && fromOf(line) && fromOf(line) !== locationName);
  // A benchtop area named after another room of the job ("Butler's Pantry benchtop" in the Kitchen) is
  // flagged even when no copied cabinet is left: the copy renamed the room's own benchtop (17 Nov 2026).
  const otherRooms = normalised.locations.map((item) => item.location).filter((name) => name && name !== locationName).sort((a, b) => b.length - a.length);
  const roomNamedIn = (area) => otherRooms.find((name) => String(area?.label || "").toLowerCase().includes(name.toLowerCase())) || "";
  const fromLocation = lines.length ? fromOf(lines[0]) : (location.benchtopAreas || []).map(roomNamedIn).find(Boolean) || "";
  const benchtopAreas = fromLocation ? (location.benchtopAreas || []).filter((area) => roomNamedIn(area)) : [];
  return { fromLocation, lines, benchtopAreas };
}
// The label a benchtop area named after another room returns to: the room's own name for that area.
export function ownBenchtopAreaLabel(locationName = "", area = {}) {
  if (/island/i.test(`${area.id || ""} ${area.label || ""}`)) return "Island benchtop";
  if (/laundry/i.test(locationName)) return "Laundry benchtop";
  if (/pantry/i.test(locationName)) return "Butler's Pantry benchtop";
  return "Main benchtop";
}
// keep: the items stay as they are (the review is recorded). remove: the copied schedule lines leave
// the room and a benchtop area named after the source room becomes the room's own main benchtop with
// no length (the builder measures it). Everything removed is kept in the audit, so it can be restored.
export function resolveCabinetryCopiedItems(selection, locationName, decision = "remove", now = new Date().toISOString()) {
  const normalised = normaliseCabinetrySelection(selection);
  const { fromLocation, lines, benchtopAreas } = cabinetryCopiedItems(normalised, locationName);
  if (!lines.length && !benchtopAreas.length) return normalised;
  const removeIds = new Set(decision === "remove" ? lines.map((line) => line.componentId) : []);
  const areaIds = new Set(decision === "remove" ? benchtopAreas.map((area) => area.id) : []);
  return normaliseCabinetrySelection({
    ...normalised,
    schedule: normalised.schedule.filter((line) => !removeIds.has(line.componentId)),
    locations: normalised.locations.map((location) => location.location !== locationName ? location : {
      ...location,
      copiedItemsReviewedAt: now,
      ...(areaIds.size ? { benchtopAreas: (location.benchtopAreas || []).map((area) => areaIds.has(area.id) ? { ...area, label: ownBenchtopAreaLabel(locationName, area), lengthMm: "", source: "manual", ...(area.surface && typeof area.surface === "object" ? { surface: { ...area.surface, applications: [ownBenchtopAreaLabel(locationName, area)] } } : {}) } : area) } : {}),
      ...(decision === "remove" ? { status: "in_progress", confirmedAt: "" } : {}),
    }),
    audit: [...normalised.audit, { action: decision === "remove" ? "remove_copied_room_items" : "keep_copied_room_items", location: locationName, fromLocation, removedLines: decision === "remove" ? deepClone(lines) : [], benchtopAreas: deepClone(benchtopAreas), at: now }],
  });
}

export function copyCabinetryLocation(selection, fromLocation, toLocations = []) {
  // The Kitchen is the master cabinetry room (17 Nov 2026): no other room's specification is ever
  // copied into it. Kitchen finishes go the other way through applyKitchenFinishesToRooms.
  toLocations = (toLocations || []).filter((name) => name !== "Kitchen");
  const normalised = normaliseCabinetrySelection(selection);
  const source = normalised.locations.find((location) => location.location === fromLocation);
  if (!source) return normalised;
  // The specification each destination had, kept so a full replacement is auditable and reversible.
  const replaced = normalised.locations.filter((location) => toLocations.includes(location.location))
    .map((location) => ({ location: location.location, specification: deepClone(location), schedule: deepClone(normalised.schedule.filter((item) => item.location === location.location)) }));
  const sourceSchedule = normalised.schedule.filter((item) => item.location === fromLocation);
  const copiedSchedule = toLocations.flatMap((toLocation) => sourceSchedule.map((item, index) => ({
    ...item,
    componentId: `${item.componentId || "CAB-COPY"}-${slugValue(toLocation)}-${index + 1}`,
    location: toLocation,
    // Provenance lives on the line and in the audit, never in the notes the client reads (17 Nov 2026).
    notes: cabinetryNotesWithoutCopyProvenance(item.notes),
    copiedFromLocation: fromLocation,
  })));
  return normaliseCabinetrySelection({
    ...normalised,
    locations: normalised.locations.map((location) => toLocations.includes(location.location) ? { ...source, id: location.id, name: location.name, location: location.location, locationType: location.locationType, projectRoomId: location.projectRoomId || "", reviewApproval: null, status: "in_progress", confirmedAt: "", source: `copied_from_${fromLocation}`, copiedFromLocation: fromLocation, benchtopAreas: benchtopAreasForCopiedRoom(source.benchtopAreas, fromLocation, location.location) } : location),
    schedule: [
      ...normalised.schedule.filter((item) => !toLocations.includes(item.location)),
      ...copiedSchedule,
    ],
    audit: [...normalised.audit, { action: "copy_location_selections", fromLocation, toLocations, replaced, at: new Date().toISOString() }],
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
  if (!source || !toLocation || toLocation === "Kitchen") return normalised;
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

// Copying FINISHES between rooms never changes a room's cabinetry scope (16 Nov 2026). A room that
// already has its own scope only takes colours for the areas it has; anything else is reported as
// skipped instead of being added. Before this, copying Kitchen colours put the Kitchen's island bench
// back into Butler's Pantry, which then listed an "Island benchtop" it does not have. A brand-new
// room with no scope yet may still take the common areas from the copy (the request that used to be
// refused), but never room-specific structure such as an island. Bulkheads and kick panels are
// finishes every cabinetry room carries, whether or not they are listed in its scope.
const ROOM_SPECIFIC_COLOUR_AREAS = new Set(["islandBenchBack"]);
const ALWAYS_PRESENT_COLOUR_AREAS = new Set(["bulkheads", "kickPanels"]);
export function colourCopyAreaAllowed(target = {}, areaKey = "") {
  if (ALWAYS_PRESENT_COLOUR_AREAS.has(areaKey)) return true;
  const enabled = Array.isArray(target.enabledAreaKeys) ? target.enabledAreaKeys : [];
  if (enabled.length) return enabled.includes(areaKey);
  return !ROOM_SPECIFIC_COLOUR_AREAS.has(areaKey);
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
  // Copying used to be refused for any area the Pantry had not already enabled, which is the
  // normal state when the Kitchen is specified first. The request itself is what puts the area
  // in scope, so an area carrying a Kitchen colour is enabled here rather than skipped.
  const requested = Array.isArray(areaKeys) && areaKeys.length
    ? areaKeys
    : Object.keys(kitchen.areaSelections || {}).filter((areaKey) => plainObject(kitchen.areaSelections[areaKey]));
  const copiedAreaKeys = requested.filter((areaKey) => {
    const source = kitchen.areaSelections?.[areaKey];
    if (!plainObject(source)) return false;
    if (!colourCopyAreaAllowed(pantry, areaKey)) return false;
    if (!overwrite && plainObject(pantry.areaSelections?.[areaKey]) && cabinetryAreaHasFinish(pantry.areaSelections[areaKey])) return false;
    return true;
  });
  if (!copiedAreaKeys.length) return normalised;
  const areaSelections = { ...(pantry.areaSelections || {}) };
  copiedAreaKeys.forEach((areaKey) => {
    areaSelections[areaKey] = deepClone(kitchen.areaSelections[areaKey]);
    pantryEnabled.add(areaKey);
  });
  const nextPantry = {
    ...pantry,
    status: "in_progress",
    confirmedAt: "",
    source: pantry.source || "project_default",
    enabledAreaKeys: Array.from(pantryEnabled),
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

// Generic version of the Kitchen->Butler's Pantry copy above: copies only colour/finish
// fields (never schedule/benchtop/handles/features) from any completed source location to
// any number of target locations in the same room category (standard vs wet-area). Kitchen
// -> Butler's Pantry/Laundry and Bathroom -> Ensuite/Powder Room both go through this one
// mechanism rather than a per-pair implementation.
export function applicableColourTargetRooms(locations = [], sourceLocationName) {
  const source = (locations || []).find((location) => location.location === sourceLocationName);
  if (!source) return [];
  const sourceIsWetArea = isWetAreaCabinetryLocationName(sourceLocationName);
  return locations
    .filter((location) => location.location !== sourceLocationName && isWetAreaCabinetryLocationName(location.location) === sourceIsWetArea)
    .map((location) => ({
      location: location.location,
      alreadyLinked: location.coloursAndFinishes?.colourSourceLocation === sourceLocationName
        || (sourceLocationName === "Kitchen" && location.coloursAndFinishes?.kitchenColourSource === "Kitchen"),
    }));
}

export function applyRoomColoursToTargets(selection, {
  sourceLocationName,
  targetLocationNames = [],
  areaKeys = [],
  overwrite = false,
} = {}) {
  const normalised = normaliseCabinetrySelection(selection);
  const source = normalised.locations.find((location) => location.location === sourceLocationName);
  if (!source || !targetLocationNames.length) return { selection: normalised, appliedSummary: {} };
  const requested = Array.isArray(areaKeys) && areaKeys.length
    ? areaKeys
    : Object.keys(source.areaSelections || {}).filter((areaKey) => plainObject(source.areaSelections[areaKey]));
  let nextLocations = normalised.locations;
  const appliedSummary = {};
  // Areas the source has a colour for that are not part of a target room's cabinetry (never added).
  const skippedSummary = {};
  targetLocationNames.forEach((targetLocationName) => {
    const target = nextLocations.find((location) => location.location === targetLocationName);
    if (!target) { appliedSummary[targetLocationName] = []; return; }
    const targetEnabled = new Set(Array.isArray(target.enabledAreaKeys) ? target.enabledAreaKeys : []);
    const outOfScope = requested.filter((areaKey) => plainObject(source.areaSelections?.[areaKey]) && !colourCopyAreaAllowed(target, areaKey));
    if (outOfScope.length) skippedSummary[targetLocationName] = outOfScope;
    const copiedAreaKeys = requested.filter((areaKey) => {
      const sourceValue = source.areaSelections?.[areaKey];
      if (!plainObject(sourceValue)) return false;
      if (!colourCopyAreaAllowed(target, areaKey)) return false;
      if (!overwrite && plainObject(target.areaSelections?.[areaKey]) && cabinetryAreaHasFinish(target.areaSelections[areaKey])) return false;
      return true;
    });
    appliedSummary[targetLocationName] = copiedAreaKeys;
    if (!copiedAreaKeys.length) return;
    const areaSelections = { ...(target.areaSelections || {}) };
    copiedAreaKeys.forEach((areaKey) => {
      areaSelections[areaKey] = deepClone(source.areaSelections[areaKey]);
      targetEnabled.add(areaKey);
    });
    const nextTarget = {
      ...target,
      status: "in_progress",
      confirmedAt: "",
      source: target.source || "project_default",
      enabledAreaKeys: Array.from(targetEnabled),
      areaSelections,
      supplier: target.supplier || source.supplier,
      productRange: target.productRange || source.productRange,
      finish: target.finish || source.finish,
      defaultColour: target.defaultColour || copiedAreaKeys.map((areaKey) => areaSelections[areaKey]).find(Boolean) || null,
      coloursAndFinishes: {
        ...(target.coloursAndFinishes || {}),
        areaSelections,
        colourSourceLocation: sourceLocationName,
        colourSourceAppliedAt: new Date().toISOString(),
        colourSourceAppliedAreaKeys: copiedAreaKeys,
      },
    };
    nextLocations = nextLocations.map((location) => location.location === targetLocationName ? nextTarget : location);
  });
  return {
    selection: normaliseCabinetrySelection({
      ...normalised,
      locations: nextLocations,
      audit: [
        ...normalised.audit,
        {
          action: "apply_room_colours_to_targets",
          sourceLocationName,
          targetLocationNames,
          appliedSummary,
          skippedSummary,
          overwrite,
          at: new Date().toISOString(),
        },
      ],
    }),
    appliedSummary,
    skippedSummary,
  };
}

// "Apply Kitchen finishes to other rooms" (17 Nov 2026). The Kitchen is the master cabinetry
// selection: the client chooses it first, then picks which other cabinetry rooms take its finishes.
// Only compatible finish and style choices are copied - colours (with their door material), handles,
// benchtop surfaces and the bulkhead / kick-panel finish - and only into slots the target room
// already has and has not chosen itself (overwrite: false). Cabinet quantities, the schedule,
// benchtop areas and lengths, room layout and unrelated products are never copied. A bathroom-style
// room maps the Kitchen door colour onto its own vanity / linen areas and the Kitchen base handle and
// benchtop onto each vanity it has. Every target can then be customised without touching the Kitchen.
const KITCHEN_TO_WET_AREAS = {
  lowerDoorsDrawers: ["floorVanityDoors", "floorVanityDrawers", "wallVanityDoors", "wallVanityDrawers"],
  tallPantryDoors: ["tallLinenDoors"],
  endPanels: ["tallLinenEndPanels"],
};
// Bathroom to bathroom (18 Nov 2026): a vanity finish is a vanity finish whether the vanity stands on
// the floor or hangs on the wall, so Main Bathroom's wall-vanity colour reaches an Ensuite whose
// vanity is floor-mounted. Before this the copy matched area keys exactly and silently skipped them.
const VANITY_PARTS = ["Doors", "Drawers", "TowelDisplay"];
const WET_TO_WET_AREAS = Object.fromEntries(VANITY_PARTS.flatMap((part) => [
  [`floorVanity${part}`, [`floorVanity${part}`, `wallVanity${part}`]],
  [`wallVanity${part}`, [`wallVanity${part}`, `floorVanity${part}`]],
]));
const VANITY_SCOPE_KEYS = ["floorMountedVanity", "wallMountedVanity"];
// The source record a bathroom item (handle / benchtop) of the target takes: the same item, or the
// other vanity when the two rooms mount their vanities differently.
// sourceScope: the cupboards the source room has now. A record left behind for a cupboard the room no
// longer has (e.g. a floor-vanity handle after the vanity became wall-hung) is never copied when the
// room's own cupboard has one (18 Nov 2026 browser acceptance).
function wetSourceRecord(records = {}, key, isChosen, sourceScope = []) {
  const inScope = (other) => !sourceScope.length || sourceScope.includes(other);
  if (inScope(key) && isChosen(records[key])) return records[key];
  if (VANITY_SCOPE_KEYS.includes(key)) {
    const own = VANITY_SCOPE_KEYS.filter(inScope).map((other) => records[other]).find(isChosen);
    if (own) return own;
  }
  if (sourceScope.length && isChosen(records[key])) return records[key];
  return null;
}
// "Match floor-mounted vanity" chosen FOR the floor-mounted vanity names no colour at all. It is an
// unfinished slot: another bathroom's colour may fill it, and it does not count as a chosen colour
// unless another part of that same vanity / cupboard has a real colour to match.
const SELF_REFERENCE_PREFIX = { match_floor_vanity: "floorVanity", match_wall_vanity: "wallVanity", match_tall_linen: "tallLinen" };
export function cabinetryAreaSelfReference(areaKey = "", record = null) {
  const prefix = plainObject(record) ? SELF_REFERENCE_PREFIX[record.finishMode] : "";
  return Boolean(prefix) && String(areaKey).startsWith(prefix);
}
// A colour the client actually chose for this area (not empty, not a reference to itself).
export function cabinetryAreaHasRealFinish(areaKey = "", record = null) {
  return cabinetryAreaHasFinish(record) && !cabinetryAreaSelfReference(areaKey, record);
}
const KITCHEN_HANDLE_ZONES = ["base", "overhead", "tall"];
const FINISH_MODE_FIELDS = ["bulkheadFinishMode", "kickPanelFinishMode"];
const surfaceForCopy = (surface) => {
  if (!plainObject(surface)) return null;
  // Thickness, edge construction and vanity basin / depth / drop-front belong to each benchtop area
  // (benchtopFabrication.js) - a Kitchen finish copy never carries them into another room.
  const { targetKey, targetLabel, lengthMm, areaId, thickness, finishedEdgeThickness, edgeConstruction, vanityDepthMm, basinType, dropFrontMm, dropFrontDetail, ...rest } = surface;
  return deepClone(rest);
};
export function kitchenFinishTargetRooms(locations = [], sourceLocationName = "Kitchen") {
  return (locations || []).filter((location) => location?.location && location.location !== sourceLocationName && location.included !== false)
    .map((location) => ({ location: location.location, wetArea: isWetAreaCabinetryLocationName(location.location), alreadyLinked: location.coloursAndFinishes?.kitchenFinishSource === sourceLocationName }));
}

// Kept for the Kitchen-first flow and its tests: the Kitchen is one source room among the others.
export function applyKitchenFinishesToRooms(selection, { sourceLocationName = "Kitchen", targetLocationNames = [], overwrite = false } = {}) {
  return applyRoomFinishesToRooms(selection, { sourceLocationName, targetLocationNames, overwrite });
}

// The room-to-room finishes copy (18 Nov 2026; the Kitchen copy of 17 Nov generalised). Any room's
// finishes - colours with their door material, handles, benchtop surface, bulkhead / kick-panel finish,
// door profile and edges - go into the rooms the client ticks. Without `overwrite` only empty slots
// are filled (a "Match <itself>" placeholder counts as empty); with it the target's own finishes are
// replaced. The target's cabinets, vanity configuration, quantities, benchtop areas and dimensions,
// thickness, basin and layout are never copied. The Kitchen is the master room and is never a target
// of another room. `filledSummary` names what a target already had, so the screen can offer Replace.
export function applyRoomFinishesToRooms(selection, { sourceLocationName = "Kitchen", targetLocationNames = [], overwrite = false } = {}) {
  const normalised = normaliseCabinetrySelection(selection);
  const source = normalised.locations.find((location) => location.location === sourceLocationName);
  if (!source || !targetLocationNames.length) return { selection: normalised, appliedSummary: {}, skippedSummary: {}, filledSummary: {} };
  const sourceWet = isWetAreaCabinetryLocationName(source.location);
  const sourceScope = Array.isArray(source.bathroomScopeKeys) ? source.bathroomScopeKeys : [];
  const handleEmpty = (record) => !plainObject(record) || !cabinetryHandleChosen(record);
  const surfaceChosen = (record) => plainObject(record) && cabinetryAreaHasFinish(record);
  const mainSurface = surfaceForCopy((Array.isArray(source.benchtopAreas) ? source.benchtopAreas.find((area) => plainObject(area?.surface) && !/island|breakfast/i.test(`${area.id} ${area.label}`))?.surface : null) || source.benchtop);
  // A bathroom source offers each vanity's own surface (its benchtop area, else its bathroom benchtop).
  const sourceBathroomSurfaces = sourceWet ? Object.fromEntries(VANITY_SCOPE_KEYS.map((key) => {
    const area = Array.isArray(source.benchtopAreas) ? source.benchtopAreas.find((item) => item?.id === key && plainObject(item.surface)) : null;
    return [key, area?.surface || (surfaceChosen(source.bathroomBenchtops?.[key]) ? source.bathroomBenchtops[key] : null)];
  }).filter(([, surface]) => surface)) : {};
  const appliedSummary = {};
  const skippedSummary = {};
  const filledSummary = {};
  const now = new Date().toISOString();
  const locations = normalised.locations.map((target) => {
    if (!targetLocationNames.includes(target.location) || target.location === sourceLocationName) return target;
    if (target.location === "Kitchen") { skippedSummary[target.location] = ["The Kitchen is the master room"]; appliedSummary[target.location] = []; return target; }
    const wet = isWetAreaCabinetryLocationName(target.location);
    const applied = [];
    const skipped = [];
    const filled = [];
    const next = { ...target };
    // Colours, area by area, onto the areas this room has.
    const areaSelections = { ...(target.areaSelections || {}) };
    const enabled = new Set(Array.isArray(target.enabledAreaKeys) ? target.enabledAreaKeys : []);
    const copiedAreaKeys = [];
    for (const [areaKey, colour] of Object.entries(source.areaSelections || {})) {
      if (!plainObject(colour) || !cabinetryAreaHasRealFinish(areaKey, colour)) continue;
      const map = wet ? (sourceWet ? (WET_TO_WET_AREAS[areaKey] || [areaKey]) : (KITCHEN_TO_WET_AREAS[areaKey] || [])) : null;
      const destinations = wet ? map.filter((key) => enabled.has(key)) : (colourCopyAreaAllowed(target, areaKey) ? [areaKey] : []);
      if (!destinations.length) { if (!wet || map.length) skipped.push(CABINETRY_AREA_LABELS[areaKey] || areaKey); continue; }
      for (const key of destinations) {
        if (copiedAreaKeys.includes(key)) continue;
        if (cabinetryAreaHasRealFinish(key, areaSelections[key]) && !overwrite) { filled.push(`${CABINETRY_AREA_LABELS[key] || key} colour`); continue; }
        areaSelections[key] = { ...deepClone(colour), areaKey: key };
        if (!wet) enabled.add(key);
        copiedAreaKeys.push(key);
      }
    }
    // The door material goes with the colours. A room that keeps colours of its own (not replaced) keeps
    // its material unless Replace is chosen; any change of material is always named.
    const sourceMaterial = source.doorMaterialGroup || "";
    const targetMaterial = target.doorMaterialGroup || "";
    const materialDiffers = Boolean(sourceMaterial && targetMaterial && sourceMaterial !== targetMaterial);
    const keepsOwnColours = Object.entries(target.areaSelections || {}).some(([key, record]) => !copiedAreaKeys.includes(key) && enabled.has(key) && cabinetryAreaHasRealFinish(key, record))
      || (!copiedAreaKeys.length && Object.entries(target.areaSelections || {}).some(([key, record]) => enabled.has(key) && cabinetryAreaHasRealFinish(key, record)));
    if (materialDiffers && keepsOwnColours && !overwrite) filled.push(`Door material (${targetMaterial})`);
    if (copiedAreaKeys.length) {
      const material = materialDiffers && keepsOwnColours && !overwrite ? targetMaterial : sourceMaterial || targetMaterial;
      if (materialDiffers && material === sourceMaterial) applied.push(`Door material (${targetMaterial} to ${sourceMaterial})`);
      Object.assign(next, {
        areaSelections,
        enabledAreaKeys: Array.from(enabled),
        doorMaterialGroup: material,
        doorAndPanelSelections: { ...(target.doorAndPanelSelections || {}), material },
        cabinetryFinishKey: source.cabinetryFinishKey || target.cabinetryFinishKey,
        supplier: source.supplier || target.supplier,
        productRange: source.productRange || target.productRange,
        finish: source.finish || target.finish,
        defaultColour: target.defaultColour && !overwrite ? target.defaultColour : deepClone(areaSelections[copiedAreaKeys[0]]),
      });
      applied.push(...copiedAreaKeys.map((key) => `${CABINETRY_AREA_LABELS[key] || key} colour`));
    }
    // Bulkhead and kick-panel finish (the finish only - never a bulkhead length).
    if (!wet && !sourceWet) {
      for (const field of FINISH_MODE_FIELDS) {
        const value = source[field] || source.coloursAndFinishes?.[field];
        if (!value) continue;
        const label = field === "bulkheadFinishMode" ? "Bulkhead finish" : "Kick panel finish";
        const has = target[field] || target.coloursAndFinishes?.[field];
        if (has && !overwrite) { if (has !== value) filled.push(label); continue; }
        next[field] = value;
        applied.push(label);
      }
    }
    // Handles.
    if (wet) {
      const bathroomHandles = { ...(target.bathroomHandles || {}) };
      for (const key of Array.isArray(target.bathroomScopeKeys) ? target.bathroomScopeKeys : []) {
        const record = sourceWet ? wetSourceRecord(source.bathroomHandles || {}, key, cabinetryHandleChosen, sourceScope) : (cabinetryHandleChosen(source.handles?.base) ? source.handles.base : null);
        if (!plainObject(record)) continue;
        const label = `${BATHROOM_SCOPE_LABELS[key] || key} handles`;
        if (!handleEmpty(bathroomHandles[key]) && !overwrite) { filled.push(label); continue; }
        bathroomHandles[key] = { ...deepClone(record), targetKey: key };
        applied.push(label);
      }
      next.bathroomHandles = bathroomHandles;
    } else if (!sourceWet) {
      const handles = { ...(target.handles || {}) };
      for (const zone of KITCHEN_HANDLE_ZONES) {
        const record = source.handles?.[zone];
        if (!plainObject(record) || !cabinetryHandleChosen(record)) continue;
        const label = `${zone === "base" ? "Base" : zone === "overhead" ? "Overhead" : "Tall"} handles`;
        if (!handleEmpty(handles[zone]) && !overwrite) { filled.push(label); continue; }
        handles[zone] = deepClone(record);
        applied.push(label);
      }
      next.handles = handles;
    }
    // Benchtop surface onto the benchtops this room already has; areas, lengths, thickness, depth and
    // basin stay its own. The edge construction is settled again for the new stone at the room's thickness.
    const refit = (area, surface) => {
      const placed = { ...area, surface: { ...surface } };
      const mm = benchtopFabrication(area).thicknessMm;
      return mm ? { ...placed, fabrication: withThickness(placed, mm) } : placed;
    };
    if (wet) {
      const bathroomBenchtops = { ...(target.bathroomBenchtops || {}) };
      const areas = Array.isArray(target.benchtopAreas) ? target.benchtopAreas : null;
      const placedKeys = [];
      for (const key of (Array.isArray(target.bathroomScopeKeys) ? target.bathroomScopeKeys : []).filter((item) => VANITY_SCOPE_KEYS.includes(item))) {
        const raw = sourceWet ? wetSourceRecord(sourceBathroomSurfaces, key, (value) => plainObject(value), sourceScope) : mainSurface;
        const surface = surfaceForCopy(raw);
        if (!surface) continue;
        const areaSurface = areas?.find((area) => area?.id === key)?.surface;
        const label = `${BATHROOM_SCOPE_LABELS[key] || key} benchtop`;
        if ((surfaceChosen(bathroomBenchtops[key]) || plainObject(areaSurface)) && !overwrite) { filled.push(label); continue; }
        bathroomBenchtops[key] = { ...surface, targetKey: key, targetLabel: label };
        placedKeys.push(key);
        applied.push(label);
      }
      next.bathroomBenchtops = bathroomBenchtops;
      if (areas && placedKeys.length) next.benchtopAreas = areas.map((area) => (placedKeys.includes(area.id) ? refit(area, surfaceForCopy(bathroomBenchtops[area.id])) : area));
    } else if (mainSurface && !sourceWet) {
      const areas = Array.isArray(target.benchtopAreas) ? target.benchtopAreas : null;
      if (areas && areas.length) {
        next.benchtopAreas = areas.map((area) => {
          if (plainObject(area.surface) && !overwrite) { filled.push(`${area.label || "Benchtop"} surface`); return area; }
          applied.push(`${area.label || "Benchtop"} surface`);
          return refit(area, mainSurface);
        });
        const first = next.benchtopAreas.find((area) => plainObject(area.surface));
        if (first) { next.benchtop = deepClone(first.surface); next.benchtops = deepClone(first.surface); }
      } else if (overwrite || !plainObject(target.benchtop)) {
        next.benchtop = { ...mainSurface };
        next.benchtops = { ...mainSurface };
        applied.push("Benchtop surface");
      } else filled.push("Benchtop surface");
    }
    // Door profile and edge choices (17 Nov 2026 owner brief: "profiles" are a finish, not a schedule).
    for (const [field, label] of [["customProfile", "Door profile"], ["edgeDetail", "Edge detail"], ["benchtopEdge", "Benchtop edge"]]) {
      const value = source[field];
      // edgeDetail defaults to "Matching ABS edge" (normaliseLocation), which is not a client choice.
      const has = (candidate) => candidate !== undefined && candidate !== null && candidate !== "" && !(field === "edgeDetail" && candidate === "Matching ABS edge") && !(plainObject(candidate) && !Object.keys(candidate).length);
      if (!has(value)) continue;
      if (has(target[field]) && !overwrite) { if (JSON.stringify(target[field]) !== JSON.stringify(value)) filled.push(label); continue; }
      next[field] = deepClone(value);
      applied.push(label);
    }
    appliedSummary[target.location] = applied;
    if (skipped.length) skippedSummary[target.location] = skipped;
    if (filled.length) filledSummary[target.location] = filled;
    if (!applied.length) return target;
    return {
      ...next,
      status: "in_progress",
      confirmedAt: "",
      coloursAndFinishes: {
        ...(target.coloursAndFinishes || {}),
        areaSelections: next.areaSelections || target.areaSelections || {},
        ...(next.bulkheadFinishMode ? { bulkheadFinishMode: next.bulkheadFinishMode } : {}),
        ...(next.kickPanelFinishMode ? { kickPanelFinishMode: next.kickPanelFinishMode } : {}),
        kitchenFinishSource: sourceLocationName,
        kitchenFinishAppliedAt: now,
        kitchenFinishApplied: applied,
        ...(copiedAreaKeys.length ? { colourSourceLocation: sourceLocationName, colourSourceAppliedAt: now, colourSourceAppliedAreaKeys: copiedAreaKeys } : {}),
      },
    };
  });
  return {
    selection: normaliseCabinetrySelection({
      ...normalised,
      locations,
      audit: [...normalised.audit, { action: sourceLocationName === "Kitchen" ? "apply_kitchen_finishes_to_rooms" : "apply_room_finishes_to_rooms", sourceLocationName, targetLocationNames, appliedSummary, skippedSummary, filledSummary, overwrite, at: now }],
    }),
    appliedSummary,
    skippedSummary,
    filledSummary,
  };
}

// Every finish the copy reported as applied is in the saved selection (used before the screen
// reports success): the target's colour records carry the source's ids, and so on.
export function roomFinishesCopyVerified(selection, { sourceLocationName, appliedSummary = {} } = {}) {
  const normalised = normaliseCabinetrySelection(selection);
  const source = normalised.locations.find((location) => location.location === sourceLocationName);
  if (!source) return {};
  return Object.fromEntries(Object.entries(appliedSummary).filter(([, items]) => items.length).map(([room]) => {
    const target = normalised.locations.find((location) => location.location === room);
    // Only the colours this copy wrote (stamped with this copy's time); markers left by an earlier copy
    // of other areas are not this copy's work (18 Nov 2026 browser acceptance).
    const marks = target?.coloursAndFinishes || {};
    const keys = marks.colourSourceAppliedAt && marks.colourSourceAppliedAt === marks.kitchenFinishAppliedAt ? marks.colourSourceAppliedAreaKeys || [] : [];
    const colourIds = new Set(Object.values(source.areaSelections || {}).filter(plainObject).map((record) => record.id || record.colourName));
    const coloursOk = keys.every((key) => colourIds.has(target.areaSelections?.[key]?.id || target.areaSelections?.[key]?.colourName));
    return [room, Boolean(target) && coloursOk && target.coloursAndFinishes?.kitchenFinishSource === sourceLocationName];
  }));
}

// An area that is explicitly overridden in a target room stops being "inherited", even
// though the room may still carry other genuinely-copied areas. Both real override paths
// (the guided colour picker's applyCabinetryRecordToAreas and this data-layer helper) call
// this so the two never disagree about which areas are still linked to their source room.
export function clearInheritedColourMarker(location, areaKeys = []) {
  const appliedAreaKeys = Array.isArray(location?.coloursAndFinishes?.colourSourceAppliedAreaKeys) ? location.coloursAndFinishes.colourSourceAppliedAreaKeys : [];
  const legacyAppliedAreaKeys = Array.isArray(location?.coloursAndFinishes?.kitchenColourAppliedAreaKeys) ? location.coloursAndFinishes.kitchenColourAppliedAreaKeys : [];
  if (!appliedAreaKeys.length && !legacyAppliedAreaKeys.length) return location.coloursAndFinishes || {};
  const remaining = appliedAreaKeys.filter((areaKey) => !areaKeys.includes(areaKey));
  const legacyRemaining = legacyAppliedAreaKeys.filter((areaKey) => !areaKeys.includes(areaKey));
  return {
    ...(location.coloursAndFinishes || {}),
    colourSourceAppliedAreaKeys: remaining,
    kitchenColourAppliedAreaKeys: legacyRemaining,
  };
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
    // The setup and surfaces carry over; the lengths are the other room's own and do not.
    next.benchtopSetup = deepClone(source.benchtopSetup || null);
    // A section copy takes surfaces, not the destination's own thickness / vanity fabrication or its lengths.
    next.benchtopAreas = Array.isArray(source.benchtopAreas) ? deepClone(source.benchtopAreas).map(({ fabrication, ...area }, index) => ({ ...area, lengthMm: destination.benchtopAreas?.[index]?.lengthMm || "", source: "manual", ...(destination.benchtopAreas?.[index]?.fabrication ? { fabrication: destination.benchtopAreas[index].fabrication } : {}) })) : null;
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
    notes: cabinetryNotesWithoutCopyProvenance(item.notes),
    copiedFromLocation: fromLocation,
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
    // The client's bulkhead decision (keep standard / add / remove) and whether the builder allows removal.
    ...(plainObject(location.bulkheadChoice) && ["standard", "add", "remove"].includes(location.bulkheadChoice.choice) ? { bulkheadChoice: location.bulkheadChoice } : {}),
    ...(location.bulkheadRemovalPermitted === true ? { bulkheadRemovalPermitted: true } : {}),
    doorMaterialGroup: location.doorMaterialGroup || location.doorAndPanelSelections?.material || "Standard colourboard",
    // The canonical finish key the quotation is resolved by (standard_colourboard, two_pack ...).
    // Always derived from the room's material here, so the stored key can never disagree with it;
    // blank for a material with no quoted finish (Other/custom).
    cabinetryFinishKey: cabinetryFinishFor(location.doorMaterialGroup || location.doorAndPanelSelections?.material || "Standard colourboard")?.key || "",
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
    // The client's benchtop setup and the actual benchtop runs, each with its own surface.
    benchtopSetup: plainObject(location.benchtopSetup) ? location.benchtopSetup : null,
    benchtopAreas: Array.isArray(location.benchtopAreas) ? location.benchtopAreas : null,
    bathroomBenchtops: plainObject(location.bathroomBenchtops) ? location.bathroomBenchtops : {},
    benchtopEdge: location.benchtopEdge || "",
    benchtopUpstand: location.benchtopUpstand || "",
    handles: location.handles || {},
    bathroomHandles: plainObject(location.bathroomHandles) ? location.bathroomHandles : {},
    ...(normaliseBuilderConfirmItems(location.builderConfirmItems).length ? { builderConfirmItems: normaliseBuilderConfirmItems(location.builderConfirmItems) } : {}),
    integratedAppliances: Array.isArray(location.integratedAppliances) ? location.integratedAppliances : [],
    features: Array.isArray(location.features) ? location.features : Array.isArray(location.featureOptions) ? location.featureOptions : [],
    featureOptions: Array.isArray(location.featureOptions) ? location.featureOptions : Array.isArray(location.features) ? location.features : [],
    notes: location.notes || "",
    confirmedAt: location.confirmedAt || "",
    projectRoomId: location.projectRoomId || "",
    // The shared identity a room was moved off (repairSharedCabinetryRoomIdentities); its approval stands.
    ...(location.projectRoomIdRepairedFrom ? { projectRoomIdRepairedFrom: location.projectRoomIdRepairedFrom } : {}),
    ...(location.copiedItemsReviewedAt ? { copiedItemsReviewedAt: location.copiedItemsReviewedAt } : {}),
    ...(plainObject(location.vanityMountingReconciled) ? { vanityMountingReconciled: location.vanityMountingReconciled } : {}),
    reviewApproval: location.reviewApproval || null,
  };
}

function fallbackCabinetryAreaSelection(areaKey, modes = {}) {
  if (areaKey === "bulkheads" && ["raw_mdf_site_paint", "laminex_decorative_300", "laminex_decorative_450"].includes(modes.bulkheadFinishMode)) {
    // The four kitchen bulkhead options (cabinetryRequirements.js BULKHEAD_FINISH_OPTIONS).
    const option = bulkheadFinishOption(modes.bulkheadFinishMode);
    const laminex = modes.bulkheadFinishMode !== "raw_mdf_site_paint";
    return {
      id: `bulkheads-${modes.bulkheadFinishMode.replace(/_/g, "-")}`, areaKey,
      material: laminex ? "Laminex Decorative Board" : "Raw MDF", finalFinish: laminex ? "Decorative board" : "Site-painted",
      colourName: option.label, finish: option.label, supplier: laminex ? "Laminex" : "", productRange: option.label,
      priceStatus: option.priced ? "included" : "rate_required", finishMode: modes.bulkheadFinishMode,
      procurementDescription: laminex ? `Supply and install ${option.label} bulkheads.` : "Supply and install Raw MDF bulkheads (300mm / 450mm), painted on site.",
      scheduleDescription: laminex ? `Supply and install ${option.label} bulkheads.` : "Supply and install Raw MDF bulkheads (300mm / 450mm), painted on site.",
    };
  }
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
      // Stable cabinet item id shared with the Quotation Builder (cabinetryRequirements.js).
      // Blank on a line saved before the shared taxonomy; unitType is then its only name.
      cabinetTypeId: item.cabinetTypeId || "",
      ...(item.migratedFrom ? { migratedFrom: item.migratedFrom } : {}),
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
      // Bulkhead runs (LM), an open shelving unit's configuration and the Sharkfin upgrade's options
      // (cabinetryRequirements.js) travel with the line.
      ...(Array.isArray(item.runs) ? { runs: item.runs.map((run) => ({ id: run?.id || "", location: run?.location || "", lengthMm: run?.lengthMm ?? "" })) } : {}),
      ...(item.shelfUnit && typeof item.shelfUnit === "object" ? { shelfUnit: { ...item.shelfUnit } } : {}),
      ...(item.quantityOverride != null && item.quantityOverride !== "" ? { quantityOverride: item.quantityOverride } : {}),
      ...(item.includeTall === true ? { includeTall: true } : {}),
      ...(item.sharkfinExcluded === true ? { sharkfinExcluded: true } : {}),
      ...(item.clientAddedBulkhead === true ? { clientAddedBulkhead: true } : {}),
      // How many of this line's cabinets stand in the island (builder, 18 Nov 2026). Never a second
      // line: the island is made of the room's ordinary cabinets and is charged once, on this line.
      ...(numberValue(item.islandQuantity) > 0 ? { islandQuantity: Math.min(quantity, Math.round(numberValue(item.islandQuantity))) } : {}),
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

const BATHROOM_SCOPE_LABELS = {
  floorMountedVanity: "Floor-mounted vanity",
  wallMountedVanity: "Wall-mounted vanity",
  tallLinenCupboard: "Tall linen cupboard",
  mirroredShavingCabinet: "Mirrored shaving cabinet",
};

// Canonical list of exactly what is blocking a room's completion, in the same terms the
// summary's unresolvedLocations check (below) uses to decide it at all - a room the UI
// message calls complete can never be one the validator still calls unresolved, because
// both read this one list. Each entry names the actual missing field, not a generic notice.
// Items the builder has taken over ("Builder will confirm") no longer block the room; they are
// listed by cabinetryBuilderConfirmedItems instead.
export function cabinetryLocationMissingRequirements(location = {}) {
  const confirmed = new Set(normaliseBuilderConfirmItems(location.builderConfirmItems).map((item) => item.key));
  return rawCabinetryMissingRequirements(location).filter((item) => !confirmed.has(item.key));
}

export function cabinetryBuilderConfirmedItems(location = {}) {
  const missing = new Set(rawCabinetryMissingRequirements(location).map((item) => item.key));
  return normaliseBuilderConfirmItems(location.builderConfirmItems).filter((item) => missing.has(item.key));
}

function normaliseBuilderConfirmItems(items) {
  return (Array.isArray(items) ? items : []).filter((item) => plainObject(item) && item.key).map((item) => ({ key: String(item.key), label: String(item.label || item.key), stage: String(item.stage || ""), by: String(item.by || ""), at: String(item.at || "") }));
}

// A handle counts as chosen once any of the fields the Handles step writes is set
// (opening method, product, code or finish) - not only colour-style fields.
export function cabinetryHandleChosen(record) {
  if (!plainObject(record)) return false;
  return Boolean(record.openingMethod || record.productName || record.productCode || record.id || record.selectedFinish || record.finish || record.colourName);
}

function rawCabinetryMissingRequirements(location = {}) {
  const missing = [];
  // Nothing scheduled and no area chosen: the room has no cabinetry defined yet.
  if (!location.enabledAreaKeys?.length) {
    missing.push({ key: "schedule", label: "Cabinet schedule", stage: "Cabinet Schedule" });
    return missing;
  }
  incompleteCabinetryColourAreas(location).forEach((areaKey) => {
    missing.push({ key: `colour:${areaKey}`, label: `${CABINETRY_AREA_LABELS[areaKey] || areaKey} colour`, stage: "Colours & Finishes" });
  });
  if (isWetAreaCabinetryLocationName(location.location)) {
    const scope = Array.isArray(location.bathroomScopeKeys) ? location.bathroomScopeKeys : [];
    const benchtops = plainObject(location.bathroomBenchtops) ? location.bathroomBenchtops : {};
    const handles = plainObject(location.bathroomHandles) ? location.bathroomHandles : {};
    ["floorMountedVanity", "wallMountedVanity"].filter((key) => scope.includes(key)).forEach((key) => {
      if (!cabinetryAreaHasFinish(benchtops[key])) missing.push({ key: `benchtop:${key}`, label: `${BATHROOM_SCOPE_LABELS[key]} benchtop`, stage: "Benchtops" });
    });
    ["floorMountedVanity", "wallMountedVanity", "tallLinenCupboard", "mirroredShavingCabinet"].filter((key) => scope.includes(key)).forEach((key) => {
      if (!cabinetryHandleChosen(handles[key])) missing.push({ key: `handles:${key}`, label: `${BATHROOM_SCOPE_LABELS[key]} handles`, stage: "Handles" });
    });
  } else if (cabinetryRoomGroup(location.location)) {
    // A wardrobe room (Bedroom 1, WIR ...) has no benchtop and its doors carry their own handles.
    if (!location.benchtop) missing.push({ key: "benchtop", label: "Benchtop selection", stage: "Benchtops" });
    if (!location.handles?.base) missing.push({ key: "handles", label: "Handles", stage: "Handles" });
  }
  return missing;
}

function buildCabinetrySummary(locations, schedule, handleQuantity, quoteRequiredItems, scheduleApproved, confirmed, allowance = 2500, revision = "draft", jobId = "") {
  const first = locations[0] || {};
  const primaryColour = first.areaSelections?.lowerDoorsDrawers?.colourName || first.defaultColour?.colourName || "No colour selected";
  const benchtop = first.benchtop?.thickness ? `${first.benchtop.range} ${first.benchtop.thickness}` : first.benchtop?.range || "No benchtop selected";
  const handle = first.handles?.base?.productName || "No handle selected";
  const unresolved = locations.filter((location) => !location.confirmedAt && cabinetryLocationMissingRequirements(location).length).map((location) => location.location);
  const completeRoomCount = locations.filter(isCabinetryRoomComplete).length;
  const approvedRoomCount = locations.filter(location => isCabinetryRoomApproved(location, schedule, jobId)).length;
  const status = !locations.length ? "not_started" : unresolved.length || completeRoomCount < locations.length ? "in_progress" : "complete";
  return {
    label: locations.length ? `${completeRoomCount} of ${locations.length} specifications complete; ${approvedRoomCount} approved` : "No cabinetry rooms added",
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
    approvedRoomCount,
    status,
    allowance,
    selectedPrice: null,
    variation: null,
    quoteRequiredItems,
    colourIncompleteAreas: Object.fromEntries(locations.map((location) => [location.location, incompleteCabinetryColourAreas(location)])),
    unresolvedLocations: unresolved,
    readyToConfirm: Boolean(locations.length) && scheduleApproved && !unresolved.length,
    complete: Boolean(locations.length) && approvedRoomCount === locations.length && !unresolved.length,
    revision,
  };
}

// Kick panels and bulkheads are completed through the dedicated Kick-panel Finish / Bulkhead
// Finish sections (kickPanelFinishMode / bulkheadFinishMode), not through the upper Cabinet Areas
// colour list. A room with either key left over in enabledAreaKeys from legacy data must not be
// blocked here - those dedicated sections are authoritative for completeness.
const CABINETRY_COLOUR_AREA_VALIDATION_EXCLUSIONS = ["kickPanels", "bulkheads"];

function incompleteCabinetryColourAreas(location = {}) {
  const enabled = Array.isArray(location.enabledAreaKeys)
    ? location.enabledAreaKeys.filter((key) => CABINETRY_AREA_KEYS.includes(key) && !CABINETRY_COLOUR_AREA_VALIDATION_EXCLUSIONS.includes(key))
    : [];
  const selections = location.areaSelections || {};
  return enabled.filter((areaKey) => {
    const record = selections[areaKey];
    if (!cabinetryAreaHasFinish(record)) return true;
    if (!cabinetryAreaSelfReference(areaKey, record)) return false;
    // "Match floor-mounted vanity" on the floor vanity's drawers is fine when its doors have a colour.
    const prefix = SELF_REFERENCE_PREFIX[record.finishMode];
    return !Object.entries(selections).some(([key, value]) => key !== areaKey && key.startsWith(prefix) && cabinetryAreaHasRealFinish(key, value));
  });
}

function cabinetryAreaHasFinish(selection) {
  if (!plainObject(selection)) return false;
  if (selection.finishMode && selection.finishMode !== "cabinetry_colour") return true;
  return Boolean(selection.id || selection.colourId || selection.colourName || selection.finish || selection.productRange || selection.productFamily);
}

export function isLaundryCabinetryLocationName(locationName = "") {
  return /laundry/i.test(String(locationName || ""));
}

// Unit types offered in a room's Cabinet Schedule. Laundry gets its own list; every other
// non-wet-area room keeps the Kitchen list unchanged. Wet areas use the bathroom schedule groups.
export function cabinetryScheduleTypeOptionsForLocation(locationName = "") {
  return isLaundryCabinetryLocationName(locationName) ? LAUNDRY_CABINETRY_SCHEDULE_TYPE_OPTIONS : CABINETRY_SCHEDULE_TYPE_OPTIONS;
}

// A wet area is any room the quotation prices as bathroom cabinetry - the job's real room names
// (Main Bathroom, Bathroom, Ensuite, B2 Ensuite, Powder Room, WC ...), not a fixed list of three.
export function isWetAreaCabinetryLocationName(locationName = "") {
  return cabinetryRoomGroup(locationName) === "bathroom";
}

function cabinetryScheduleLineValidForLocation(item = {}, location = {}) {
  if (!location || !item) return false;
  if (item.cabinetTypeId) return cabinetryRequirementTypes(cabinetryRoomGroup(location.location || location.name)).some(type => type.key === item.cabinetTypeId);
  const type = item.type || item.unitType || "";
  if (isWetAreaCabinetryLocationName(location.location || location.name || item.location)) {
    return WET_AREA_CABINETRY_SCHEDULE_TYPES.includes(type);
  }
  return !WET_AREA_CABINETRY_SCHEDULE_TYPES.includes(type);
}

// The room's handle record and schedule lines, as the quotation reads them (rooms merged under one
// project room share their handles), so BOQ, RFQ and procurement carry the quotation's quantities.
function scheduleMeasure(item, locations, schedule) {
  const key = cabinetryRoomKey(item.location);
  const room = locations.filter((entry) => cabinetryRoomKey(entry.location) === key).reduce((held, entry) => ({ handles: { ...held.handles, ...(entry.handles || {}) }, bathroomHandles: { ...held.bathroomHandles, ...(entry.bathroomHandles || {}) } }), { handles: {}, bathroomHandles: {} });
  return cabinetScheduleMeasure(item, room, schedule.filter((line) => cabinetryRoomKey(line.location) === key));
}

function buildCabinetryBoqLines(locations, schedule) {
  const cabinetryLines = schedule.flatMap((item) => {
    const location = locations.find((entry) => entry.location === item.location) || {};
    const measure = scheduleMeasure(item, locations, schedule);
    const colour = location.areaSelections?.[item.clientSelectableSurfaces?.[0]] || location.defaultColour || {};
    const baseLine = {
      sourceSelectionId: "cabinetry",
      location: item.location,
      componentId: item.componentId,
      cabinetTypeId: item.cabinetTypeId || "",
      itemName: `${item.location} ${measure.name || item.unitType}`,
      quantity: measure.quantity,
      unit: measure.unit,
      ...(measure.note ? { quantityBasis: measure.note } : {}),
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
    // Handles are counted on cabinets; a bulkhead, a shelf unit or the upgrade line itself has none.
    const handleLine = handle && measure.unit === "ITEM" ? {
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
      const location = locations.find((entry) => entry.location === item.location) || {};
      const colour = location.areaSelections?.[item.clientSelectableSurfaces?.[0]] || location.defaultColour || {};
      const handle = location.handles?.base || {};
      const measure = scheduleMeasure(item, locations, schedule);
      return {
        componentId: item.componentId,
        cabinetTypeId: item.cabinetTypeId || "",
        location: item.location,
        unitType: measure.name || item.unitType,
        quantity: measure.quantity,
        unit: measure.unit,
        ...(measure.note ? { quantityBasis: measure.note } : {}),
        ...(item.shelfUnit ? { shelfUnit: item.shelfUnit } : {}),
        ...(Array.isArray(item.runs) ? { runs: item.runs } : {}),
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

// ---- Room sequence -----------------------------------------------------------------------------
// The ONE ordered list of a project's cabinetry rooms: the locations configured on the job's
// cabinetry selection, in the standard room order, then any custom locations in the order they
// were added. Next / Previous between rooms, room progress and the summary all read this list;
// nothing else decides which rooms exist or what order they come in.
// Rooms are ordered by kind, so project names such as "Main Bathroom" or "B2 Ensuite" sit
// beside their standard counterparts instead of falling to the end.
const CABINETRY_ROOM_KIND_ORDER = [/kitchen/i, /pantry/i, /bath/i, /ensuite/i, /powder|wc|toilet/i, /laundry/i];
export function cabinetryRoomRank(name = "") {
  const standard = CABINETRY_LOCATIONS.indexOf(name);
  const kind = CABINETRY_ROOM_KIND_ORDER.findIndex((pattern) => pattern.test(name));
  // An exact standard name leads its kind; "Other" and custom rooms follow every listed kind.
  return (kind === -1 ? CABINETRY_ROOM_KIND_ORDER.length : kind) * 2 + (standard === -1 || kind === -1 ? 1 : 0);
}

export function cabinetryRoomSequence(locations = []) {
  return (locations || []).filter((location) => location?.location)
    .map((location, added) => ({ location, added }))
    .sort((a, b) => cabinetryRoomRank(a.location.location) - cabinetryRoomRank(b.location.location) || a.added - b.added)
    .map((item) => item.location);
}

// The configured room after (direction 1) or before (direction -1) `locationName`, or null at
// either end. Whether a room is complete never changes where Next and Previous go.
export function adjacentCabinetryRoom(locations = [], locationName = "", direction = 1) {
  const sequence = cabinetryRoomSequence(locations);
  const index = sequence.findIndex((location) => location.location === locationName);
  return index === -1 ? null : sequence[index + (direction < 0 ? -1 : 1)] || null;
}

export function isCabinetryRoomComplete(location = {}) {
  return location?.status === "complete" || Boolean(location?.confirmedAt) || cabinetryLocationMissingRequirements(location).length === 0;
}

// Store the exact canonical specification, not timestamps or catalogue price refreshes.
const approvalMetadata = /^(reviewApproval|confirmedAt|status|source|copiedFromLocation|copiedSelectionsEditable|updatedAt|lastModifiedAt|selectedAt|createdAt|priceStatus|priceState|price|rrp|clientPrice|selectedPrice|variation|variationAmount|estimatedRate|estimatedTotal)$/;
// Builder measurements are not part of what the client approves (16 Nov 2026): a benchtop length or
// depth, a bulkhead run, or a takeoff measurement record entered in the Quotation Builder used to
// change the fingerprint, so the builder measuring a room silently withdrew the client's approval.
// Builder-owned facts, never part of what the client approves: measurements, the island cabinet count
// (18 Nov 2026) and the stone's edge construction (the client chooses the finished thickness only).
const builderMeasurementKeys = /^(lengthMm|depthMm|runs|measurement|benchtopDimensions|edgeLengthMm|islandQuantity|edgeConstruction)$/;
function approvalSpecification(value, ignore = approvalMetadata) {
  if (Array.isArray(value)) return value.map((item) => approvalSpecification(item, ignore));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().filter(key => !approvalMetadata.test(key) && !(ignore !== approvalMetadata && ignore.test(key))).map(key => [key, approvalSpecification(value[key], ignore)]));
}

// { legacy: true } is the fingerprint used before 16 Nov 2026 (measurements included). Approvals stored
// with it are still honoured (isCabinetryRoomApproved), so no existing approval is withdrawn.
export function cabinetrySpecificationRevision(location, schedule = [], { legacy = false } = {}) {
  const fields = ["enabledAreaKeys", "bathroomScopeKeys", "doorMaterialGroup", "supplier", "productRange", "finish", "areaSelections", "defaultColour", "bulkheadFinishMode", "kickPanelFinishMode", "edgeDetail", "benchtop", "benchtopSetup", "benchtopAreas", "benchtopDimensions", "bathroomBenchtops", "benchtopEdge", "benchtopUpstand", "handles", "bathroomHandles", "featureOptions", "integratedAppliances", "notes", "customRange", "customProfile", "customMaterial", "customColour", "customFinish", "customSupplier", "customDescription", "customReferenceImage"];
  const specification = Object.fromEntries(fields.map(key => [key, location[key] ?? null]));
  specification.schedule = schedule.filter(line => line.location === location.location).map(({ location: ignored, ...line }) => line);
  // Only when made, so rooms approved before the bulkhead question existed stay approved.
  if (location.bulkheadChoice?.choice && location.bulkheadChoice.choice !== "standard") specification.bulkheadChoice = location.bulkheadChoice.choice;
  // Only when used, so existing approvals are unchanged; taking over or handing back an item needs re-approval.
  const builderConfirmKeys = normaliseBuilderConfirmItems(location.builderConfirmItems).map((item) => item.key).sort();
  if (builderConfirmKeys.length) specification.builderConfirmKeys = builderConfirmKeys;
  return JSON.stringify(legacy ? approvalSpecification(specification) : approvalSpecification(specification, builderMeasurementKeys));
}

// A stored fingerprint (either form) with the builder's measurements taken out, so approvals made
// before 16 Nov 2026 survive a later builder measurement as well.
function withoutBuilderMeasurements(revision) {
  if (typeof revision !== "string" || !revision) return revision;
  try { return JSON.stringify(approvalSpecification(JSON.parse(revision), builderMeasurementKeys)); } catch { return revision; }
}

export function isCabinetryRoomApproved(location, schedule = [], jobId = "") {
  const approval = location?.reviewApproval;
  return Boolean(approval?.approvedAt && approval.jobId && (!jobId || approval.jobId === jobId)
    && (approval.roomId === (location.projectRoomId || location.id) || (location.projectRoomIdRepairedFrom && approval.roomId === location.projectRoomIdRepairedFrom))
    && withoutBuilderMeasurements(approval.specificationRevision) === cabinetrySpecificationRevision(location, schedule));
}

// Kitchen first (17 Nov 2026 owner brief): the Kitchen is the master cabinetry room, so on a job
// where it has never been approved the other cabinetry rooms wait for it. A job whose Kitchen (or any
// other room) was approved before - even if a later change withdrew that approval - is not locked,
// so existing jobs keep working room by room.
export function cabinetryKitchenFirstPending(selection, jobId = "") {
  const locations = Array.isArray(selection?.locations) ? selection.locations.filter((location) => location?.location && location.included !== false) : [];
  const kitchen = locations.find((location) => location.location === "Kitchen");
  if (!kitchen) return false;
  if (locations.some((location) => location.reviewApproval?.approvedAt || location.confirmedAt)) return false;
  return !isCabinetryRoomApproved(kitchen, selection.schedule || [], jobId);
}

export function approveCabinetryRoom(selection, roomId, jobId, now = new Date().toISOString()) {
  if (!jobId) throw new Error("A job identity is required to approve cabinetry.");
  const normalised = normaliseCabinetrySelection({ ...selection, projectId: jobId });
  const matches = normalised.locations.filter(room => (room.projectRoomId || room.id) === roomId);
  if (!matches.length) throw new Error("The cabinetry room identity is not present on this job.");
  if (matches.length > 1) throw new Error(`${matches.map(room => room.location).join(" and ")} share one room identity, so the approval cannot be recorded. Reopen the job and try again.`);
  const location = matches[0];
  if (cabinetryLocationMissingRequirements(location).length) throw new Error(`${location.location} has incomplete cabinetry specifications.`);
  if (isCabinetryRoomApproved(location, normalised.schedule, jobId)) return normalised;
  const approved = normaliseCabinetrySelection({
    ...normalised,
    locations: normalised.locations.map(room => room === location ? {
      ...room, status: "complete", confirmedAt: now,
      reviewApproval: { jobId, roomId, approvedAt: now, specificationRevision: cabinetrySpecificationRevision(room, normalised.schedule) },
    } : room),
  });
  // Never report an approval that does not hold once the selection is normalised again.
  const check = approved.locations.find(room => room.location === location.location);
  if (!check || !isCabinetryRoomApproved(check, approved.schedule, jobId)) throw new Error(`${location.location} approval could not be verified. Nothing was approved.`);
  return approved;
}

export function cabinetryProjectRoomOptions(selection, model = { rooms: [] }) {
  const locations = selection.locations || [];
  if (!model?.rooms?.length) return [...new Set([...CABINETRY_LOCATIONS, ...locations.map(room => room.location)])].map(name => ({ name }));
  const applicable = model.rooms.filter(room => !room.removed && (/kitchen|pantry|bathroom|ensuite|powder|laundry/i.test([room.name, room.roomType, ...(room.sourceKeys || [])].join(" ")) || locations.some(location => location.projectRoomId === room.id || canonicalProjectRoomName(location.location, model) === room.name)));
  const options = applicable.map(room => ({ name: room.name, id: room.id }));
  locations.forEach(location => {
    const name = canonicalProjectRoomName(location.location, model);
    if (!options.some(room => room.name === name)) options.push({ name, id: location.projectRoomId || "" });
  });
  return options.map((room, added) => ({ room, added }))
    .sort((a, b) => cabinetryRoomRank(a.room.name) - cabinetryRoomRank(b.room.name) || a.added - b.added)
    .map(item => item.room);
}

// Room progress for the cabinetry screens ("2 of 6 locations complete"). The overall Client
// Selections count still treats Cabinetry as one requirement; this is the detail inside it.
export function cabinetryRoomProgress(locations = []) {
  const sequence = cabinetryRoomSequence(locations);
  const complete = sequence.filter(isCabinetryRoomComplete).length;
  return { complete, total: sequence.length, rooms: sequence.map((location) => ({ location: location.location, complete: isCabinetryRoomComplete(location) })),
    label: sequence.length ? `${complete} of ${sequence.length} specifications complete` : "No cabinetry locations configured" };
}

// ---- Client bulkhead decision --------------------------------------------------------------------
// "Would you like bulkheads above your overhead kitchen cabinetry?" The client answers keep standard /
// add / remove; no length is asked. Included as standard = the builder scheduled a bulkhead line
// (one the client did not add). Adding schedules a bulkhead line with no runs, which the quantity
// engine reports "Bulkhead length required" to the estimator; removing leaves the builder's line and
// its measured runs untouched until the variation is approved in Quotation Builder.
const isBulkheadLine = (line, room) => line.location === room && /^bulkhead_/.test(String(line.cabinetTypeId || ""));
export function cabinetryBulkheadOptions(location = {}, schedule = []) {
  const room = location.location;
  const standardIncluded = schedule.some((line) => isBulkheadLine(line, room) && !line.clientAddedBulkhead);
  const choice = location.bulkheadChoice?.choice || "standard";
  const removalPermitted = location.bulkheadRemovalPermitted === true;
  return {
    standardIncluded, choice, removalPermitted,
    options: [
      { key: "standard", label: "Keep standard inclusion", detail: standardIncluded ? "Bulkheads are included in your standard inclusions." : "No bulkheads - as per your standard inclusions.", available: true },
      { key: "add", label: "Add bulkheads", detail: "Finished enclosure from the top of the overhead cabinets to the ceiling.", available: !standardIncluded },
      { key: "remove", label: "Remove bulkheads", detail: removalPermitted ? "Your builder allows bulkheads to be removed in this room." : "Not available - your builder has not allowed removal in this room.", available: standardIncluded && removalPermitted },
    ],
    effective: choice === "add" ? true : choice === "remove" ? false : standardIncluded,
  };
}

export function applyCabinetryBulkheadChoice(selection = {}, roomName = "", choice = "standard", now = new Date().toISOString()) {
  const locations = selection.locations || [];
  const location = locations.find((room) => room.location === roomName);
  if (!location) throw new Error(`${roomName} is not a cabinetry room on this job.`);
  const schedule = Array.isArray(selection.schedule) ? selection.schedule : [];
  const options = cabinetryBulkheadOptions(location, schedule);
  const option = options.options.find((entry) => entry.key === choice);
  if (!option?.available) throw new Error(`${option?.label || choice} is not available for ${roomName}.`);
  const withoutClientLine = schedule.filter((line) => !(isBulkheadLine(line, roomName) && line.clientAddedBulkhead));
  const nextSchedule = choice === "add"
    ? [...withoutClientLine, { componentId: `bulkhead-client-${slugValue(roomName)}`, location: roomName, cabinetTypeId: "bulkhead_300", unitType: "MDF bulkhead", type: "MDF bulkhead", quantity: 0, handleQuantity: 0, runs: [], clientAddedBulkhead: true, notes: "Added by client - builder to confirm height and length" }]
    : withoutClientLine;
  const bulkheadChoice = choice === "standard" ? null : { choice, standardIncluded: options.standardIncluded, at: now };
  return {
    ...selection,
    schedule: nextSchedule,
    locations: locations.map((room) => {
      if (room !== location) return room;
      const { bulkheadChoice: ignored, ...rest } = room;
      return bulkheadChoice ? { ...rest, bulkheadChoice } : rest;
    }),
  };
}

// ---- Island bench back copied into a room without an island (16 Nov 2026) ------------------------
// Before colour copies were limited to a room's own scope, "Apply Kitchen Colours" put the Kitchen's
// island bench back into Butler's Pantry and Laundry, which then listed an Island benchtop. The data
// is never rewritten silently: the room shows a prompt, and the client or builder removes it here.
// Only flagged when the island came from a colour copy and the room schedules no island cabinet.
export function copiedIslandBenchBack(location = {}, schedule = []) {
  const enabled = Array.isArray(location.enabledAreaKeys) ? location.enabledAreaKeys : [];
  if (!enabled.includes("islandBenchBack")) return false;
  // The Kitchen is the master room: its island is its own (nothing is ever copied into it), and an
  // island is usually ordinary base cabinets, so "no island cabinets" was never a fact (18 Nov 2026).
  // A room whose builder has identified its island cabinets is reconciled too.
  if (location.location === "Kitchen" || cabinetryIslandLines(location, schedule).length) return false;
  const copied = [...(location.coloursAndFinishes?.colourSourceAppliedAreaKeys || []), ...(location.coloursAndFinishes?.kitchenColourAppliedAreaKeys || [])].includes("islandBenchBack");
  if (!copied) return false;
  const islandLine = (schedule || []).some((line) => line.location === location.location && Number(line.quantity) > 0 && /\bisland\b/i.test(`${line.unitType} ${line.type} ${line.cabinetTypeId} ${line.notes}`));
  return !islandLine;
}

// ---- Island configuration (18 Nov 2026) -----------------------------------------------------------
// An island is the room's ordinary cabinets (base units, drawer banks, end panels) standing
// back-to-back or with a finished back. The builder says how many of each schedule line stand in the
// island (line.islandQuantity); the island bench back colour, island end panels and the Island
// benchtop then belong to that configuration. Nothing is added to the schedule, so nothing is charged twice.
export function cabinetryIslandLines(location = {}, schedule = []) {
  return (schedule || []).filter((line) => line?.location === location.location && numberValue(line.islandQuantity) > 0 && numberValue(line.quantity) > 0);
}

export function cabinetryIslandConfiguration(location = {}, schedule = []) {
  const lines = cabinetryIslandLines(location, schedule);
  const areas = Array.isArray(location.benchtopAreas) ? location.benchtopAreas : [];
  const benchtop = areas.find((area) => area?.id === "benchtop-island" || /island/i.test(String(area?.label || ""))) || null;
  const enabled = Array.isArray(location.enabledAreaKeys) ? location.enabledAreaKeys : [];
  const hasIsland = Boolean(lines.length || benchtop || enabled.includes("islandBenchBack"));
  return {
    hasIsland,
    identified: lines.length > 0,
    cabinets: lines.filter((line) => !/_end_panel$/.test(line.cabinetTypeId || "")).map((line) => ({ componentId: line.componentId, label: line.unitType, quantity: numberValue(line.islandQuantity) })),
    endPanels: lines.filter((line) => /_end_panel$/.test(line.cabinetTypeId || "")).map((line) => ({ componentId: line.componentId, label: line.unitType, quantity: numberValue(line.islandQuantity) })),
    benchBack: enabled.includes("islandBenchBack") ? (location.areaSelections?.islandBenchBack || null) : null,
    benchtop,
  };
}

// The builder's island count for one schedule line (0 removes it from the island).
export function setCabinetryIslandQuantity(selection, componentId, islandQuantity, at = new Date().toISOString()) {
  const normalised = normaliseCabinetrySelection(selection);
  const line = normalised.schedule.find((item) => item.componentId === componentId);
  if (!line) return normalised;
  const value = Math.max(0, Math.min(numberValue(line.quantity), Math.round(numberValue(islandQuantity) || 0)));
  const schedule = normalised.schedule.map((item) => {
    if (item.componentId !== componentId) return item;
    const { islandQuantity: ignored, ...rest } = item;
    return value > 0 ? { ...rest, islandQuantity: value } : rest;
  });
  return normaliseCabinetrySelection({
    ...normalised,
    schedule,
    audit: [...normalised.audit, { action: "set_island_quantity", location: line.location, componentId, unitType: line.unitType, previous: line.islandQuantity || 0, islandQuantity: value, at }],
  });
}

export function removeCopiedIslandBenchBack(selection, locationName, at = new Date().toISOString()) {
  const normalised = normaliseCabinetrySelection(selection);
  const location = normalised.locations.find((item) => item.location === locationName);
  if (!location || !copiedIslandBenchBack(location, normalised.schedule)) return normalised;
  const without = (keys) => (Array.isArray(keys) ? keys.filter((key) => key !== "islandBenchBack") : keys);
  const dropIsland = (selections) => {
    if (!plainObject(selections)) return selections;
    const { islandBenchBack, ...rest } = selections;
    return rest;
  };
  const enabledAreaKeys = without(location.enabledAreaKeys);
  const next = {
    ...location,
    enabledAreaKeys,
    scope: enabledAreaKeys,
    areaSelections: dropIsland(location.areaSelections),
    coloursAndFinishes: { ...(location.coloursAndFinishes || {}), areaSelections: dropIsland(location.coloursAndFinishes?.areaSelections),
      colourSourceAppliedAreaKeys: without(location.coloursAndFinishes?.colourSourceAppliedAreaKeys), kitchenColourAppliedAreaKeys: without(location.coloursAndFinishes?.kitchenColourAppliedAreaKeys) },
    // An island benchtop listed only because of the copied scope goes too (one with a chosen surface stays).
    benchtopAreas: Array.isArray(location.benchtopAreas) ? location.benchtopAreas.filter((area) => !(/island/i.test(`${area.id} ${area.label}`) && !area.surface)) : location.benchtopAreas,
    benchtopSetup: plainObject(location.benchtopSetup) ? { ...location.benchtopSetup, islandRemoved: true } : location.benchtopSetup,
    status: "in_progress",
    confirmedAt: "",
  };
  return normaliseCabinetrySelection({
    ...normalised,
    locations: normalised.locations.map((item) => (item.location === locationName ? next : item)),
    audit: [...normalised.audit, { action: "remove_copied_island_bench_back", location: locationName, previous: { enabledAreaKeys: location.enabledAreaKeys, islandBenchBack: location.areaSelections?.islandBenchBack || null }, at }],
  });
}
