import { CLIENT_SELECTION_CATEGORIES } from "./clientSelectionCategories.js";
import { SELECTION_SLOT_IDS } from "./selectionRegistry.js";
import { normalizeProductType } from "../product-library/selectionProductDiscovery.js";

const SLOT_REQUIREMENTS = Object.freeze({
  kitchen_sink: ["sink"],
  kitchen_mixer: ["sink-mixer"],
  oven: ["oven"],
  cooktop: ["cooktop"],
  dishwasher: ["dishwasher"],
  toilet_suite: ["toilet-suite"],
  basin: ["bathroom-basin"],
  basin_mixer: ["basin-mixer"],
  bath: ["bath"],
  shower_mixer: ["bath-mixer"],
  shower_screen: ["shower-screen"],
  mirror: ["mirror"],
  floor_tile: ["tiling-rooms"],
  wall_tile: ["tiling-rooms"],
  carpet: ["interior-flooring"],
  timber_flooring: ["interior-flooring"],
  internal_door_handle: ["door-hardware"],
  external_door_handle: ["entry-door"],
  robe_fitout: ["robes"],
});

const EXTRA_REQUIREMENTS = [
  ["sink", "Sink", ["kitchen sink", "kitchen sinks", "sink", "sinks"]],
  ["sink-mixer", "Sink Mixer", ["kitchen tapware", "kitchen mixer", "sink mixer", "kitchen sink mixer"]],
  ["bathroom-basin", "Bathroom Basin", ["basin", "basins", "bathroom basin", "bathroom basins"]],
  ["basin-mixer", "Basin Mixer", ["basin mixer", "basin tap", "basin taps"]],
  ["toilet-suite", "Toilet Suite", ["toilet", "toilets", "toilet suite", "toilet suites"]],
  ["bath", "Bath", ["bath", "baths", "bathtub", "bathtubs"]],
  ["bath-mixer", "Bath & Shower Mixer", ["bath mixer", "shower mixer", "bath and shower mixer"]],
  ["shower-fixtures", "Shower Fixtures", ["showers", "shower rail", "shower rose", "shower head", "shower outlet", "shower set"]],
  ["bath-spout", "Bath Spout", ["bath spout"]],
  ["laundry-tub", "Laundry Tub", ["laundry tub", "laundry trough"]],
  ["hot-water-system", "Hot Water System", ["hot water", "hot-water", "water heater", "continuous flow heater", "hot water system"]],
  ["oven", "Oven", ["ovens", "built in oven", "built-in oven"]],
  ["cooktop", "Cooktop", ["cooktops", "hot plate", "induction cooktop", "gas cooktop"]],
  ["rangehood", "Rangehood", ["rangehood", "range hood"]],
  ["dishwasher", "Dishwasher", ["dishwashers"]],
  ["microwave", "Microwave", ["microwaves"]],
  ["fridge", "Fridge", ["fridges", "refrigerator", "refrigerators"]],
  ["electrical-schedule", "Electrical Schedule", ["electrical point", "power point", "data point"]],
  ["interior-lighting", "Lighting", ["lighting", "downlight", "pendant light", "light fitting"]],
  ["ceiling-fan", "Ceiling Fans", ["ceiling fan"]],
  ["air-conditioning", "Air Conditioning", ["air conditioning", "hvac", "split system", "ducted air"]],
  ["entry-door", "Entry Door", ["entry door", "entrance door"]],
  ["internal-doors", "Internal Doors", ["internal door", "interior door"]],
  ["door-hardware", "Door Hardware", ["door handle", "passage lever", "door furniture"]],
  ["entry-door-furniture", "Entry Door Furniture", ["entry door furniture", "entrance lever set", "deadbolt"]],
  ["floor-waste", "Floor Waste", ["floor waste", "floor drain", "linear drain"]],
  ["skirting", "Skirting", ["skirting"]],
  ["architraves", "Architraves", ["architrave"]],
  ["stairs", "Stairs", ["stairs", "stair system", "staircase"]],
  ["robes", "Wardrobe Systems", ["wardrobe", "robe fitout", "robe shelving"]],
  ["interior-flooring", "Flooring", ["flooring", "carpet", "hybrid flooring", "vinyl flooring", "engineered timber"]],
  ["tiling-rooms", "Tiles & Stone", ["tiles", "tile", "floor tiles", "wall tiles", "splashback tiles"]],
  ["cabinetry", "Cabinetry & Benchtops", ["cabinetry", "benchtop", "bench top", "vanity cabinet"]],
  ["cladding", "External Cladding", ["cladding", "linea board"]],
  ["roofing", "Roofing", ["roofing", "roof tiles", "metal roofing"]],
  ["windows", "Windows", ["windows", "glazing"]],
  ["garage-door", "Garage Doors", ["garage door"]],
  ["exterior-lighting", "External Lighting", ["external lighting", "exterior light"]],
  ["exterior-paint", "Exterior Paint Colours", ["exterior paint", "external paint", "exterior colours"]],
  ["interior-paint", "Internal Paint Colours", ["interior paint", "internal paint", "paint colours"]],
  ["driveway", "Driveway Finishes", ["driveway", "driveway finish"]],
  ["balustrades", "Balustrades", ["balustrade"]],
  ["solar-system", "Solar PV System", ["solar pv", "solar system"]],
  ["home-battery", "Home Battery", ["home battery", "battery storage"]],
  ["ev-charger", "EV Charger", ["ev charger", "electric vehicle charger"]],
  ["entry-door", "Entry Door", ["entry door", "entry doors", "entrance door"]],
  ["internal-doors", "Internal Doors", ["internal door", "internal doors", "interior door", "interior doors"]],
  ["door-hardware", "Door Hardware", ["door handle", "door handles", "passage lever", "door furniture"]],
  ["skirting", "Skirting", ["skirting board", "skirting boards"]],
  ["architraves", "Architraves", ["architrave", "architraves"]],
  ["stairs", "Stairs", ["stair", "staircase", "staircases"]],
  ["robes", "Wardrobe Systems", ["wardrobe", "wardrobes", "robe fitout", "robe shelving"]],
];

const CATEGORY_REQUIREMENTS = CLIENT_SELECTION_CATEGORIES.flatMap((category) => (category.requirementKeys || []).map((key) => ({
  requirementKey: key,
  label: category.label,
  categoryKey: category.key,
  categoryLabel: category.label,
  estimateSection: category.estimateSection || "",
  selectionModel: category.selectionModel || "product",
  selectionSlotIds: Object.entries(SLOT_REQUIREMENTS).filter(([, requirements]) => requirements.includes(key)).map(([slot]) => slot),
  aliases: [key, category.label, category.key, category.estimateSection].filter(Boolean),
})));

export const SELECTION_REQUIREMENT_DEFINITIONS = Object.freeze((() => {
  const byKey = new Map(CATEGORY_REQUIREMENTS.map((entry) => [entry.requirementKey, entry]));
  for (const [requirementKey, label, aliases] of EXTRA_REQUIREMENTS) {
    const current = byKey.get(requirementKey);
    byKey.set(requirementKey, {
      requirementKey,
      label: current?.label || label,
      categoryKey: current?.categoryKey || "",
      categoryLabel: current?.categoryLabel || "",
      estimateSection: current?.estimateSection || "",
      selectionModel: current?.selectionModel || "product",
      selectionSlotIds: current?.selectionSlotIds || [],
      aliases: [...new Set([...(current?.aliases || []), requirementKey, label, ...aliases])],
    });
  }
  return [...byKey.values()];
})());

const definitionByKey = new Map(SELECTION_REQUIREMENT_DEFINITIONS.map((entry) => [entry.requirementKey, entry]));
const aliases = new Map();
for (const definition of SELECTION_REQUIREMENT_DEFINITIONS) {
  for (const alias of definition.aliases) {
    const key = normalizeProductType(alias);
    if (!key) continue;
    aliases.set(key, [...new Set([...(aliases.get(key) || []), definition.requirementKey])]);
  }
}
for (const [slot, requirementKeys] of Object.entries(SLOT_REQUIREMENTS)) {
  if (!SELECTION_SLOT_IDS.includes(slot)) continue;
  for (const requirementKey of requirementKeys) {
    aliases.set(normalizeProductType(slot), [...new Set([...(aliases.get(normalizeProductType(slot)) || []), requirementKey])]);
  }
}

const rowOfProduct = (product = {}) => product.metadata?.productEntity || product;
const listValues = (value) => (Array.isArray(value) ? value : value == null || value === "" ? [] : [value]).map(String);

function aliasCandidates(value) {
  const normalized = normalizeProductType(value);
  if (!normalized) return [];
  const exact = aliases.get(normalized);
  if (exact) return exact;
  const matches = [];
  for (const [alias, requirementKeys] of aliases) {
    if (alias.length >= 5 && normalized.includes(alias)) matches.push(...requirementKeys);
  }
  return [...new Set(matches)];
}

export function requirementsForProduct(product = {}) {
  const entity = rowOfProduct(product);
  const explicit = [
    ...listValues(entity.requirementKeys || entity.requirement_keys),
    ...listValues(entity.clientSelectionRequirement || entity.client_selection_requirement),
    ...listValues(entity.selectionSlotIds || entity.selection_slot_ids).flatMap(slot => SLOT_REQUIREMENTS[slot] || []),
  ].filter(key => definitionByKey.has(key));
  if (explicit.length) return [...new Set(explicit)].map(key => definitionByKey.get(key));

  const descriptors = [
    ...listValues(entity.requirementType || entity.requirement_type),
    ...listValues(entity.productType || entity.product_type),
    ...listValues(entity.subcategory || entity.subCategory || entity.sub_category),
    ...listValues(entity.familyKey || entity.family_key),
    ...listValues(entity.category || entity.categoryKey || entity.category_key),
    entity.productName || entity.product_name || entity.name || "",
  ];
  let candidates = [];
  for (const descriptor of descriptors) {
    const next = aliasCandidates(descriptor);
    if (!next.length) continue;
    if (!candidates.length) candidates = next;
    else {
      const intersection = candidates.filter(key => next.includes(key));
      if (intersection.length) candidates = intersection;
      else if (next.length === 1) candidates = next;
    }
    if (candidates.length === 1) break;
  }
  return candidates.map(key => definitionByKey.get(key));
}

export function classifyProductRequirements(product = {}) {
  const matches = requirementsForProduct(product);
  if (!matches.length) return { status: "UNCLASSIFIED", requirementKeys: [], selectionSlotIds: [], matches: [] };
  const selectionSlotIds = [...new Set(matches.flatMap(item => item.selectionSlotIds))];
  const status = matches.length > 1 ? "REVIEW_REQUIRED" : "CLASSIFIED";
  return { status, requirementKeys: matches.map(item => item.requirementKey), selectionSlotIds, matches };
}

export function requirementDefinition(requirementKey = "") {
  return definitionByKey.get(requirementKey) || null;
}

export function requirementsForSelectionSlot(selectionSlotId = "") {
  if (!SELECTION_SLOT_IDS.includes(selectionSlotId)) return [];
  return (SLOT_REQUIREMENTS[selectionSlotId] || []).map(key => definitionByKey.get(key)).filter(Boolean);
}

export function requirementKeysForSelectionSlot(selectionSlotId = "") {
  return requirementsForSelectionSlot(selectionSlotId).map(item => item.requirementKey);
}

export function requirementSelectionSlotIds(requirementKeys = []) {
  const keys = new Set(requirementKeys);
  return [...new Set(Object.entries(SLOT_REQUIREMENTS).flatMap(([slot, requirements]) => requirements.some(key => keys.has(key)) ? [slot] : []))];
}

export function selectionFoundationStatus(requirement = {}) {
  const requirementKey = String(requirement.requirementKey || requirement.requirementType || "");
  const definition = requirementDefinition(requirementKey);
  if (!definition) return { selectionStatus: "UNMAPPED", quoteMappingStatus: "REVIEW_REQUIRED", reason: "Requirement type is not in the shared taxonomy" };
  const target = requirement.quoteTargetMapping || requirement.quoteTarget || null;
  const selectionSlotId = requirement.selectionSlotId || definition.selectionSlotIds[0] || null;
  if (target?.rowId && (target.sectionId || target.section)) return { selectionStatus: "SELECTED", quoteMappingStatus: "MAPPED", selectionSlotId, quoteTargetMapping: target };
  const section = requirement.estimateSection || definition.estimateSection;
  if (section) return { selectionStatus: "SELECTED", quoteMappingStatus: "REQUIREMENT_MAPPED", quoteTargetVerified: false, selectionSlotId, quoteSection: section };
  return { selectionStatus: "SELECTED", quoteMappingStatus: "TEMPLATE_MAPPING_REQUIRED", quoteTargetVerified: false, selectionSlotId, reason: "Configure this requirement once for the builder's quotation template" };
}

export function selectionRequirementQuoteTarget(workbook = {}, requirementKey = "") {
  const definition = requirementDefinition(requirementKey);
  if (!definition) return { status: "REVIEW_REQUIRED", requirementKey, reason: "Unknown requirement type" };
  const matching = Object.entries(workbook.quotation || {}).flatMap(([section, group]) => (group.rows || []).filter(row =>
    row.requirementKey === requirementKey
    || (Array.isArray(row.requirementKeys) && row.requirementKeys.includes(requirementKey))
    || row.selectionSlotId && definition.selectionSlotIds.includes(row.selectionSlotId)
  ).map(row => ({ section, rowId: row.id, row })));
  if (matching.length === 1) return { status: "MAPPED", requirementKey, target: matching[0], source: "stable-row-requirement-id" };
  if (matching.length > 1) return { status: "REVIEW_REQUIRED", requirementKey, reason: "Multiple quotation rows claim this requirement", candidates: matching.map(({ section, rowId }) => ({ section, rowId })) };
  return definition.estimateSection
    ? { status: "REQUIREMENT_MAPPED", requirementKey, section: definition.estimateSection, source: "shared-requirement-category", reason: "Add/update a requirement-scoped selection row in this trade section" }
    : { status: "TEMPLATE_MAPPING_REQUIRED", requirementKey, reason: "Builder quotation template has no target section for this requirement" };
}