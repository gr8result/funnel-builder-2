const normalize = (value) => String(value || "").trim().toLowerCase();
const taxonomyKey = (value) => normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const clean = (value, limit = 500) => String(value ?? "").trim().slice(0, limit);
const amountOrNull = (value) => value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);

const CATEGORY_FAMILY_RULES = [
  { families: ["cabinetry", "cabinet-finish", "laminate-benchtops", "stone-20mm-tops", "stone-40mm-tops", "stone-benchtops"], aliases: ["cabinetry", "cabinetry and benchtops", "kitchen cabinetry", "kitchen cabinetry and benchtops", "laundry cabinetry"] },
  { families: ["cabinet-finish"], aliases: ["cabinet finishes", "cabinet finish", "cabinet door finishes", "cabinet door finish"] },
  { families: ["laminate-benchtops", "stone-20mm-tops", "stone-40mm-tops", "stone-benchtops"], aliases: ["benchtops", "kitchen benchtops", "stone benchtops", "laminate benchtops"] },
  { families: ["handles"], aliases: ["cabinet handles", "cabinet hardware"] },
  { families: ["ovens"], aliases: ["oven", "ovens", "oven and cooktop", "kitchen appliances", "appliances", "kitchen appliances and tapware"] },
  { families: ["cooktops"], aliases: ["cooktop", "cooktops", "oven and cooktop", "kitchen appliances", "appliances", "kitchen appliances and tapware"] },
  { families: ["freestanding-cookers"], aliases: ["freestanding cookers", "kitchen appliances", "appliances"] },
  { families: ["rangehoods"], aliases: ["rangehood", "rangehoods", "kitchen appliances", "appliances", "kitchen appliances and tapware"] },
  { families: ["dishwashers"], aliases: ["dishwasher", "dishwashers", "kitchen appliances", "appliances", "kitchen appliances and tapware"] },
  { families: ["microwaves"], aliases: ["microwave", "microwaves", "kitchen appliances", "appliances", "kitchen appliances and tapware"] },
  { families: ["fridges"], aliases: ["fridge", "fridges", "refrigerator", "kitchen appliances", "appliances", "kitchen appliances and tapware"] },
  { families: ["appliance-packs"], aliases: ["appliance packages", "appliance pack", "kitchen appliances", "appliances"] },
  { families: ["kitchen-sink-mixers", "tapware", "kitchen-taps"], aliases: ["tapware", "kitchen tapware", "kitchen appliances and tapware"] },
  { families: ["kitchen-sink-mixers", "kitchen-taps", "tapware", "mixers-tapware"], aliases: ["kitchen mixers", "kitchen mixer"] },
  { families: ["mixers-tapware", "tapware", "basin-mixer"], aliases: ["basin mixers", "basin mixer", "bathroom tapware"] },
  { families: ["mixers-tapware", "tapware", "shower-mixer"], aliases: ["shower mixers", "shower mixer"] },
  { families: ["showers"], aliases: ["showerheads", "shower heads", "shower outlets"] },
  { families: ["sinks", "kitchen-sinks"], aliases: ["kitchen sink", "kitchen sinks", "kitchen appliances and tapware"] },
  { families: ["kitchen-sinks", "laundry-tubs"], aliases: ["laundry tubs", "laundry tub", "laundry trough"] },
  { families: ["tapware", "kitchen-sink-mixers", "laundry-tapware"], aliases: ["laundry tapware", "laundry mixer", "laundry mixers"] },
  { families: ["boiling-chilled-filtered"], aliases: ["filtered water taps", "filtered water tap", "boiling chilled filtered"] },
  { families: ["roofing", "gutters-fascia"], aliases: ["roofing", "roof", "roofing gutters fascia", "roofing gutters and fascia", "roofing / gutters / fascia"] },
  { families: ["bricks", "cladding"], aliases: ["external walls and cladding", "external walls", "external wall finishes"] },
  { families: ["roofing", "gutters-fascia"], aliases: ["roofing", "roof", "roofing gutters fascia", "roofing gutters and fascia", "roofing / gutters / fascia"] },
  { families: ["bricks"], aliases: ["bricks", "brickwork", "masonry", "external brickwork"] },
  { families: ["cladding"], aliases: ["cladding", "external cladding", "weatherboard", "external wall cladding"] },
  { families: ["driveway"], aliases: ["driveway", "driveway finishes"] },
  { families: ["decking"], aliases: ["decking", "deck"] },
  { families: ["pool"], aliases: ["pool", "pool finishes"] },
  { families: ["retaining-walls"], aliases: ["retaining walls", "retaining wall"] },
  { families: ["landscaping"], aliases: ["landscaping", "landscape finishes"] },
  { families: ["windows", "entry-doors"], aliases: ["windows and external doors", "windows / glazing and external doors"] },
  { families: ["windows"], aliases: ["windows", "window systems", "windows and glazing", "glazing"] },
  { families: ["garage-doors"], aliases: ["garage door", "garage doors"] },
  { families: ["balustrades"], aliases: ["balustrades", "balustrade", "handrails", "stairs and balustrades"] },
  { families: ["air-conditioning"], aliases: ["air conditioning", "hvac", "heating and cooling"] },
  { families: ["heating"], aliases: ["heating", "heating systems", "indoor heating", "heaters", "fireplaces"] },
  { families: ["exhaust-fans"], aliases: ["exhaust fans", "exhaust fan", "bathroom exhaust fans"] },
  { families: ["splashback"], aliases: ["splashback", "splashbacks", "laundry splashback"] },
  { families: ["skirting"], aliases: ["skirting", "architraves", "skirting and architraves", "fix-out trim"] },
  { families: ["internal-doors"], aliases: ["internal doors", "internal door", "internal doors and hardware", "internal doors & hardware"] },
  { families: ["door-hardware"], aliases: ["internal door hardware", "internal door handles", "door furniture"] },
  { families: ["internal-doors", "door-hardware"], aliases: ["internal doors and door furniture", "internal doors & door furniture"] },
  { families: ["cavity-sliding-door-cages", "internal-doors"], aliases: ["cavity sliding door cages", "cavity door hardware"] },
  { families: ["entry-doors"], aliases: ["external doors", "external door", "entry door", "entrance door", "entrance doors"] },
  { families: ["entry-door-furniture"], aliases: ["external door hardware", "external door handle", "external door handles", "entry door furniture", "entrance door handle"] },
  { families: ["door-hardware"], aliases: ["internal door hardware", "internal door handles"] },
  { families: ["electrical", "lighting", "ceiling-fans"], aliases: ["electrical and lighting", "electrical / lighting"] },
  { families: ["lighting"], aliases: ["electrical fixtures", "exhaust fans", "smoke alarms", "power points", "light switches"] },
  { families: ["electrical"], aliases: ["technology", "communications", "technology communications", "technology / communications", "technology and communications", "electrical technology", "electrical and communications"] },
  { families: ["lighting"], aliases: ["lighting", "lighting and fans", "lighting & ceiling fans"] },
  { families: ["ceiling-fans"], aliases: ["ceiling fans", "lighting and fans", "lighting & ceiling fans"] },
  { families: ["external-lighting"], aliases: ["external lighting", "exterior lighting", "outdoor lighting"] },
  { families: ["tiles"], aliases: ["tiles", "tiling", "wall tiles", "floor tiles", "laundry tiles", "bathroom tiles"] },
  { families: ["toilets"], aliases: ["toilets"] },
  { families: ["basins-bottle-traps"], aliases: ["basins", "basin"] },
  { families: ["baths-spas"], aliases: ["baths", "bath"] },
  { families: ["showers"], aliases: ["showers", "shower fittings", "shower mixer and fittings"] },
  { families: ["shower-screen"], aliases: ["shower screen", "shower screens"] },
  { families: ["mirror"], aliases: ["mirror", "mirrors"] },
  { families: ["bathroom-accessories"], aliases: ["bathroom accessories"] },
  { families: ["robes"], aliases: ["wardrobe systems", "wardrobes", "robes", "wardrobe and linen systems"] },
  { families: ["hot-water"], aliases: ["hot water systems", "hot water system"] },
  { families: ["garage-doors"], aliases: ["garage doors", "garage door"] },
  { families: ["splashback"], aliases: ["splashback", "kitchen splashback"] },
  { families: ["flooring"], aliases: ["flooring", "floor coverings", "carpet"] },
  { families: ["flooring"], aliases: ["carpet flooring", "hard flooring", "hybrid flooring", "laminate flooring", "vinyl flooring", "engineered timber"] },
  { families: ["paint", "interior-paint"], aliases: ["painting", "internal paint", "interior paint", "paint and wall finishes"] },
  { families: ["exterior-paint"], aliases: ["exterior paint", "external paint", "external colours"] },
  { families: ["paint", "exterior-paint"], aliases: ["painting and finishes"] },
  { families: ["stairs"], aliases: ["staircases", "staircase", "stairs"] },
  { families: ["toilets", "baths-spas", "basins-bottle-traps", "showers", "shower-screen", "mirror", "bathroom-accessories", "tiles", "floor-wastes", "plugs-wastes", "shaving-cabinet", "mixers-tapware", "basin-mixer", "shower-mixer", "shower-outlet"], aliases: ["bathrooms and ensuites", "bathroom and ensuite", "bathroom", "ensuite"] },
  { families: ["laundry-tubs", "laundry-tapware", "washing-machines", "dryers", "dishwashers", "tiles"], aliases: ["laundry", "laundry fixtures"] },
  { families: ["kitchen-sinks", "kitchen-sink-mixers", "kitchen-taps", "tapware", "mixers-tapware", "hot-water", "boiling-chilled-filtered", "toilets", "baths-spas", "basins-bottle-traps", "showers", "floor-wastes", "laundry-tubs", "laundry-tapware"], aliases: ["plumbing and hot water", "plumbing fixtures and hot water"] },
  { families: ["electrical", "lighting", "external-lighting", "ceiling-fans"], aliases: ["electrical and lighting", "electrical / lighting"] },
  { families: ["air-conditioning", "heating"], aliases: ["air conditioning and ventilation", "air conditioning", "heating and ventilation"] },
  { families: ["decking", "balustrades", "outdoor-living", "landscaping", "pool"], aliases: ["outdoor areas and landscaping", "outdoor areas", "outdoor living and landscaping"] },
];

const FAMILY_KEYS = new Set(CATEGORY_FAMILY_RULES.flatMap((rule) => rule.families));
const PRODUCT_FAMILY_ALIASES = Object.freeze({
  oven: "ovens", cooktop: "cooktops", rangehood: "rangehoods", "range-hood": "rangehoods",
  dishwasher: "dishwashers", microwave: "microwaves", fridge: "fridges", refrigerator: "fridges",
  sink: "kitchen-sinks", "kitchen-sink": "kitchen-sinks", "kitchen-mixer": "kitchen-sink-mixers",
  mixer: "tapware", "internal-door": "internal-doors", "external-door": "entry-doors",
  "entrance-door": "entry-doors", "external-door-hardware": "entry-door-furniture",
  "internal-door-furniture": "door-hardware", "ceiling-fan": "ceiling-fans",
  "light-fitting": "lighting", "wall-tile": "tiles", "floor-tile": "tiles",
  "floor-covering": "flooring", "air-conditioning": "air-conditioning",
  "basin-mixers": "basin-mixer", "shower-mixers": "shower-mixer", "shower-rails": "shower-outlet",
});
const PRODUCT_REQUIREMENT_ALIASES = Object.freeze({
  cooktops: "cooktop", rangehoods: "rangehood", dishwashers: "dishwasher", microwaves: "microwave", fridges: "fridge",
  "kitchen-taps": "sink-mixer", "kitchen-sink-mixers": "sink-mixer", "kitchen-sinks": "sink",
  ovens: "oven", toilets: "toilet-suite", showers: "shower-fixtures",
  "baths-spas": "bath", "basins-bottle-traps": "bathroom-basin",
  "laundry-tubs": "laundry-tub", "floor-wastes": "floor-waste", "plugs-wastes": "floor-waste",
  "bathroom-accessories": "bathroom-accessories", "hot-water": "hot-water-system",
  "electrical": "electrical-schedule", "ceiling-fans": "ceiling-fan",
  "exterior-paint": "exterior-paint", "freestanding-cookers": "freestanding-cooker",
  "appliance-packs": "appliance-pack", dryers: "clothes-dryer", "washing-machines": "washing-machine", solar: "solar-system",
  tiles: "tiling-rooms", heating: "indoor-heating", "boiling-chilled-filtered": "boiling-chilled-filtered-tap",
});
const FAMILY_REQUIREMENTS = Object.freeze({
  ovens: ["oven"], cooktops: ["cooktop"], rangehoods: ["rangehood"], dishwashers: ["dishwasher"],
  microwaves: ["microwave"], fridges: ["fridge"], "kitchen-sinks": ["sink"],
  "kitchen-sink-mixers": ["sink-mixer"], "kitchen-taps": ["sink-mixer"],
  "laundry-tubs": ["laundry-tub"], "laundry-tapware": ["laundry-tapware"],
  tapware: ["sink-mixer", "basin-mixer", "bath-mixer", "bath-spout", "shower-fixtures"],
  "mixers-tapware": ["sink-mixer", "basin-mixer", "bath-mixer", "bath-spout", "shower-fixtures", "mixers-tapware"],
  roofing: ["roofing"], "gutters-fascia": ["roofing"], driveway: ["driveway"], decking: ["decking"],
  pool: ["pool"], "retaining-walls": ["retaining-walls"], landscaping: ["landscaping"],
  "internal-doors": ["internal-doors"], "door-hardware": ["door-hardware"],
  "entry-doors": ["entry-door"], "entry-door-furniture": ["entry-door-furniture"],
  electrical: ["electrical-schedule"], "ceiling-fans": ["ceiling-fan"], lighting: ["interior-lighting"],
  tiles: ["tiling-rooms"], flooring: ["interior-flooring"], paint: ["interior-paint"],
  "exterior-paint": ["exterior-paint"], "air-conditioning": ["air-conditioning"],
  "interior-paint": ["interior-paint"], "basin-mixer": ["basin-mixer"],
  "shower-mixer": ["bath-mixer"], "shower-outlet": ["shower-fixtures"],
  balustrades: ["balustrades"], windows: ["windows"], "garage-doors": ["garage-door"],
  bricks: ["bricks"], cladding: ["cladding"], cabinetry: ["cabinetry"],
  "cabinet-finish": ["cabinetry"], "stone-20mm-tops": ["cabinetry", "benchtop"],
  "stone-40mm-tops": ["cabinetry", "benchtop"], "stone-benchtops": ["cabinetry", "benchtop"],
  "laminate-benchtops": ["cabinetry", "benchtop"], handles: ["cabinetry"],
  skirting: ["skirting", "architraves"], splashback: ["tiling-rooms", "splashback"],
  "external-lighting": ["external-lighting"], toilets: ["toilet-suite"],
  "baths-spas": ["bath"], "basins-bottle-traps": ["bathroom-basin"],
  showers: ["shower-fixtures"], "shower-screen": ["shower-screen"], mirror: ["mirror"],
  "basin-mixer": ["basin-mixer"], "shower-mixer": ["bath-mixer"], "shower-outlet": ["shower-fixtures"],
  "bathroom-accessories": ["bathroom-accessories"], "floor-wastes": ["floor-waste"],
  "plugs-wastes": ["floor-waste"], "shaving-cabinet": ["shaving-cabinet"],
  "boiling-chilled-filtered": ["boiling-chilled-filtered-tap"], "hot-water": ["hot-water-system"],
  heating: ["indoor-heating"], "appliance-packs": ["appliance-pack"],
  "freestanding-cookers": ["freestanding-cooker"], "washing-machines": ["washing-machine"],
  dryers: ["clothes-dryer"], solar: ["solar-system"], stairs: ["stairs"],
  robes: ["robes"], "outdoor-living": ["outdoor-living", "built-in-bbq", "outdoor-kitchen", "bbq-rangehood", "pizza-oven"],
});
const FAMILY_SELECTION_SLOTS = Object.freeze({
  ovens: ["oven"], cooktops: ["cooktop"], dishwashers: ["dishwasher"],
  "kitchen-sinks": ["kitchen_sink"], "kitchen-sink-mixers": ["kitchen_mixer"],
  "door-hardware": ["internal_door_handle"],
  "entry-door-furniture": ["external_door_handle"],
  "ceiling-fans": [], tiles: ["floor_tile", "wall_tile"], flooring: ["carpet", "timber_flooring"],
});
const CATEGORY_RULES_BY_ALIAS = new Map();
for (const rule of CATEGORY_FAMILY_RULES) {
  for (const alias of rule.aliases) {
    const key = taxonomyKey(alias);
    CATEGORY_RULES_BY_ALIAS.set(key, [...new Set([...(CATEGORY_RULES_BY_ALIAS.get(key) || []), ...rule.families])]);
  }
}

// Some supplier listings file 3-in-1 heater/exhaust/light units under lighting; the
// product name is the reliable signal that it is an exhaust fan, not a light fitting.
const EXHAUST_FAN_NAME = /\bexhaust fans?\b/i;

function productFamilyKeys(product = {}) {
  if (EXHAUST_FAN_NAME.test(product.name || product.productName || "")) return ["exhaust-fans"];
  const families = [];
  for (const value of [product.familyKey, product.categoryKey, product.productType, product.category]) {
    if (!value) continue;
    const key = taxonomyKey(value);
    const family = PRODUCT_FAMILY_ALIASES[key] || key;
    if (FAMILY_KEYS.has(family)) families.push(family);
  }
  return [...new Set(families)];
}

function productRequirementKeys(product = {}) {
  const values = product.requirementKeys || product.requirement_keys || product.clientSelectionRequirement || product.client_selection_requirement || [];
  return (Array.isArray(values) ? values : [values]).map((value) => {
    const key = taxonomyKey(value);
    return PRODUCT_REQUIREMENT_ALIASES[key] || key;
  }).filter(Boolean);
}

function familiesForCategory(category = "") {
  return CATEGORY_RULES_BY_ALIAS.get(taxonomyKey(category)) || [];
}

function productEligibleForCategory(product, category) {
  if (!product) return false;
  const allowedFamilies = familiesForCategory(category);
  const productFamilies = productFamilyKeys(product);
  if (!allowedFamilies.length || !productFamilies.length || !productFamilies.every((family) => allowedFamilies.includes(family))) return false;
  const requirements = productRequirementKeys(product);
  const slots = Array.isArray(product.selectionSlotIds) ? product.selectionSlotIds.map(taxonomyKey) : [];
  return productFamilies.some((family) => {
    if (requirements.length && FAMILY_REQUIREMENTS[family] && !requirements.some((key) => FAMILY_REQUIREMENTS[family].includes(key))) return false;
    const familySlots = FAMILY_SELECTION_SLOTS[family];
    return !slots.length || Boolean(familySlots?.length && slots.some((slot) => familySlots.includes(slot)));
  });
}

const specificationText = (value) => {
  if (!value || typeof value !== "object") return clean(value, 500);
  const entries = Array.isArray(value) ? value.map((item, index) => [String(index + 1), item]) : Object.entries(value);
  return entries.map(([key, item]) => `${key}: ${Array.isArray(item) ? item.join(", ") : String(item ?? "").trim()}`).filter((item) => !item.endsWith(": ")).join("; ").slice(0, 500);
};

// Recorded tile use (e.g. National Tiles "Area: Wall"); empty when the supplier did not state it.
function tileApplications(attributes = {}) {
  const values = Array.isArray(attributes.tileApplications) ? attributes.tileApplications : [attributes.tileArea];
  return [...new Set(values.flatMap((value) => normalize(value).split(/[^a-z]+/)).filter((value) => value === "floor" || value === "wall"))];
}

// One shape for a workspace Product Library row, shared by the AI proposal API, the review
// screen and the job baseline. `allowance` is the catalogue's base allowance (the inclusion
// basis); `price` is its recorded upgrade/client price. Neither is ever invented.
export function normalizeCatalogueProduct(row = {}) {
  const entity = row?.metadata?.productEntity || {};
  const attributes = entity.attributes || row.attributes || {};
  const gst = entity.gstIncluded ?? entity.priceIncludesGst ?? row.gst_included ?? row.gstIncluded ?? row.priceIncludesGst;
  return {
    productId: clean(row.id || row.productId || row.stableProductId || row.productCode, 120),
    name: clean(row.product_name || row.productName || entity.productName || row.name, 180),
    brand: clean(entity.brand || row.manufacturer_name || row.brand || row.manufacturer, 100),
    range: clean(entity.range || row.metadata?.range || row.range, 100),
    model: clean(row.model || entity.model || row.sku, 100),
    sku: clean(row.sku || entity.supplierSku, 100),
    colour: clean(entity.colour || entity.color || attributes.colour || attributes.color || row.colour || row.color, 100),
    finish: clean(entity.finish || attributes.finish || row.finish, 100),
    category: clean(entity.category || row.quote_structure_section || entity.topLevelArea || row.topLevelArea || row.categoryKey || row.selection_type || row.category, 120),
    familyKey: clean(entity.familyKey || entity.family_key || row.familyKey || row.family_key, 100),
    categoryKey: clean(entity.categoryKey || entity.category_key || row.categoryKey || row.category_key, 100),
    productType: clean(entity.productType || entity.familyKey || row.familyKey || row.productType || row.product_type, 120),
    description: clean(row.description || entity.description, 500),
    specification: specificationText(entity.specification || entity.specifications || row.specification || attributes.specification || attributes.specifications),
    supplier: clean(entity.supplier || row.supplier, 120),
    availableOptions: entity.attributes?.selectionFacets || entity.selectionFacets || row.selectionFacets || attributes.selectionFacets || {},
    qualityLevel: clean(entity.qualityLevel || entity.qualityTier || row.qualityLevel || attributes.qualityLevel || attributes.qualityTier, 40),
    image: clean(row.primary_image_url || row.primaryImageUrl || row.thumbnailUrl || entity.primaryImage || entity.primaryImageUrl || row.image, 400),
    imageStatus: clean(entity.imageStatus || row.image_status || row.imageStatus, 80),
    imageSource: clean(entity.imageSource || row.image_source || row.imageSource || row.sourceName, 180),
    allowance: amountOrNull(row.base_allowance ?? row.allowance ?? row.builderCost),
    price: amountOrNull(row.upgrade_cost ?? row.clientPrice ?? row.builderPrice ?? row.rrp ?? row.price),
    priceSource: clean(entity.priceSource || row.priceSource || row.price_source || (row.priceStatus === "current" && row.sourceVerifiedAt ? row.sourceName : ""), 120),
    priceEffectiveDate: clean(entity.priceEffectiveDate || entity.priceVerifiedAt || row.priceEffectiveDate || row.priceVerifiedAt || row.updated_at, 80),
    gstIncluded: typeof (gst ?? row.priceIncludesGst) === "boolean" ? (gst ?? row.priceIncludesGst) : null,
    unit: clean(row.unit || row.priceUnit || entity.priceUnit, 40),
    currency: clean(entity.currency || row.currency || "AUD", 8),
    selectionSlotIds: Array.isArray(row.selection_slot_ids || row.selectionSlotIds || entity.selectionSlotIds) ? (row.selection_slot_ids || row.selectionSlotIds || entity.selectionSlotIds).map(String) : [],
    tileApplications: tileApplications(attributes),
    requirementKeys: Array.isArray(row.requirement_keys || row.requirementKeys || entity.requirementKeys) ? (row.requirement_keys || row.requirementKeys || entity.requirementKeys).map(String) : [],
    active: row.active !== false && row.enabled !== false && row.selectable !== false && entity.active !== false && entity.archived !== true,
  };
}

// Only Product Library-verified images may appear as product photography in a published brochure.
// "review_required", "missing" or unknown statuses are shown text-only until the image is verified.
const APPROVED_IMAGE_STATUSES = new Set(["verified_exact", "verified_range"]);
export function hasApprovedProductImage(product) {
  return Boolean(product?.image && APPROVED_IMAGE_STATUSES.has(String(product.imageStatus || "")));
}

// Catalogue facts a builder must see before approving; never filled in on the product's behalf.
export function missingProductInformation(product) {
  if (!product) return [];
  const missing = [];
  if (product.allowance == null && product.price == null) missing.push("price or allowance");
  if (!product.brand) missing.push("brand");
  if (!product.model && !product.sku) missing.push("model/SKU");
  if (!product.image) missing.push("image");
  if (!product.description && !product.specification) missing.push("specification");
  if (!product.qualityLevel) missing.push("verified quality level");
  return missing;
}

export function constrainProposalCatalogue(products, preferences = {}) {
  const levels = ["economy", "standard", "mid-range", "premium"];
  const level = levels.includes(normalize(preferences.qualityLevel)) ? normalize(preferences.qualityLevel) : "standard";
  const cap = amountOrNull(preferences.maxUnitAllowance);
  const brands = (Array.isArray(preferences.preferredBrands) ? preferences.preferredBrands : []).map(normalize);
  const suppliers = (Array.isArray(preferences.preferredSuppliers) ? preferences.preferredSuppliers : []).map(normalize);
  const specifications = String(preferences.specifications || "").split(/[,;\n]/).map(normalize).filter(Boolean);
  const eligible = products.filter(product => {
    const price = product.allowance ?? product.price;
    if (!product.active || price == null || price < 0 || (cap !== null && price > cap)) return false;
    if (product.qualityLevel && normalize(product.qualityLevel) !== level) return false;
    const facts = normalize(`${product.description} ${product.specification} ${product.name} ${product.model}`);
    return specifications.every(term => facts.includes(term));
  });
  const groups = new Map();
  for (const product of eligible) {
    const key = product.selectionSlotIds?.[0] || product.productType || product.category;
    groups.set(key, [...(groups.get(key) || []), product]);
  }
  const shortlist = [];
  for (const group of groups.values()) {
    group.sort((left, right) => (left.allowance ?? left.price) - (right.allowance ?? right.price));
    const ranks = new Map(group.map((product, index) => [product.productId, index]));
    const positions = { economy: 0, standard: 0.33, "mid-range": 0.66, premium: 1 };
    const target = Math.round((group.length - 1) * positions[level]);
    group.sort((left, right) => {
      const preference = product => (brands.includes(normalize(product.brand)) ? 4 : 0) + (suppliers.includes(normalize(product.supplier)) ? 4 : 0);
      return preference(right) - preference(left) || Math.abs(ranks.get(left.productId) - target) - Math.abs(ranks.get(right.productId) - target);
    });
    shortlist.push(...group.slice(0, Math.max(1, Math.ceil(group.length / 3))));
  }
  return shortlist;
}

export function rankCatalogueCandidatesForCategories(products = [], categories = [], { perCategory = 20, totalLimit = 80 } = {}) {
  const selected = new Map();
  for (const category of Array.isArray(categories) ? categories : []) {
    const matches = (Array.isArray(products) ? products : []).filter((product) => productEligibleForCategory(product, category));
    const families = [...new Set(matches.map((product) => productFamilyKeys(product)[0]))];
    const quota = Math.max(1, Math.floor(Math.max(1, perCategory) / Math.max(1, families.length)));
    const diversified = families.flatMap((family) => matches.filter((product) => productFamilyKeys(product)[0] === family).slice(0, quota));
    const selectedForCategory = [...diversified, ...matches.filter((product) => !diversified.includes(product))].slice(0, Math.max(1, perCategory));
    for (const product of selectedForCategory) {
      const id = String(product.productId || "");
      if (id && !selected.has(id)) selected.set(id, product);
    }
  }
  return [...selected.values()].slice(0, Math.max(1, totalLimit));
}

export function limitProposalBudget(result, budget) {
  const limit = amountOrNull(budget);
  if (limit === null) return result;
  let total = 0;
  const proposals = result.proposals.filter(proposal => {
    const price = proposal.product.allowance ?? proposal.product.price;
    if (price == null || total + price > limit) return false;
    total += price;
    return true;
  });
  const covered = new Set(proposals.map(proposal => proposal.category));
  return { proposals, gaps: [...new Set([...result.gaps, ...result.proposals.filter(proposal => !covered.has(proposal.category)).map(proposal => proposal.category)])], allowanceTotal: total };
}

export function validateProductProposals({ proposals, categories, products, eligibleProductIdsByCategory = {} }) {
  const allowedCategories = new Set((categories || []).map((category) => String(category || "").trim()).filter(Boolean));
  const candidates = new Map((products || []).map((product) => [String(product.productId || ""), product]));
  const seen = new Set();
  const accepted = [];

  for (const proposal of Array.isArray(proposals) ? proposals : []) {
    const category = String(proposal?.category || "").trim();
    const candidate = candidates.get(String(proposal?.productId || "").trim());
    const product = candidate ? { ...candidate, name: candidate.name || candidate.productName || "" } : null;
    const eligibleIds = eligibleProductIdsByCategory[category];
    const isEligible = Array.isArray(eligibleIds)
      ? eligibleIds.includes(product?.productId)
      : productEligibleForCategory(product, category);
    if (!category || !allowedCategories.has(category) || !product || !isEligible) continue;
    const key = `${category}:${product.productId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const reason = [];
    if (normalize(product.category) && normalize(category).includes(normalize(product.category))) reason.push(`Catalogue category: ${product.category}.`);
    if (product.brand) reason.push(`Catalogue brand: ${product.brand}.`);
    if (product.allowance != null || product.price != null) reason.push("The Product Library has a recorded price or allowance basis to review.");
    accepted.push({
      category,
      product: { ...product },
      missingInformation: missingProductInformation(product),
      reason: reason.length ? reason.join(" ") : "AI selected this existing workspace product; verify it against the schedule requirements.",
      reviewStatus: "needs_review",
    });
  }

  const proposedCategories = new Set(accepted.map((proposal) => proposal.category));
  return {
    proposals: accepted,
    gaps: [...allowedCategories].filter((category) => !proposedCategories.has(category)),
  };
}

export function isInclusionsDraftApprovable(draft = {}) {
  const items = Array.isArray(draft.items) ? draft.items : [];
  const categories = Array.isArray(draft.categories) ? draft.categories : [];
  const excluded = new Set(Array.isArray(draft.excludedCategories) ? draft.excludedCategories : []);
  const gaps = Array.isArray(draft.gaps) ? draft.gaps : [];
  return items.length > 0
    && items.some((item) => item.reviewStatus === "approved")
    && items.every((item) => ["approved", "rejected"].includes(item.reviewStatus))
    && gaps.length === 0
    && categories.every((category) => excluded.has(category)
      || items.some((item) => item.category === category && item.reviewStatus === "approved"));
}
