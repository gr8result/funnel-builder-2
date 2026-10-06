// Catalogue section + subcategory classification rules for the Product Library.
// Extracted from pages/modules/builders/product-library.js; logic unchanged.
import { EXTERIOR_CATALOGUE_SECTIONS, exteriorSectionForProduct } from "./exteriorCatalogueSections.js";
import { slugify } from "./productLibraryFormat.js";

export const CABINETRY_SECTION_KEY = "cabinetry-joinery";
export const PLUMBING_SECTION_KEY = "plumbing-fixtures-tapware";
export const LIGHTING_ELECTRICAL_SECTION_KEY = "lighting-electrical";
export const CABINETRY_SUBCATEGORIES = [
  { key: "all", label: "All Cabinetry", fileName: "cabinetry-all.csv" },
  { key: "cabinetry-products", label: "Cabinetry Products", fileName: "cabinetry-products.csv" },
  { key: "cabinet-doors-panels", label: "Cabinet Doors & Panels", fileName: "cabinet-doors-panels.csv" },
  { key: "board-colours-finishes", label: "Board Colours & Finishes", fileName: "cabinet-board-colours-finishes.csv" },
  { key: "cabinet-handles", label: "Handles", fileName: "cabinet-handles.csv" },
  { key: "cabinet-hardware", label: "Cabinet Hardware", fileName: "cabinet-hardware.csv" },
  { key: "cabinet-benchtops", label: "Benchtops & Surfaces", fileName: "cabinet-benchtops.csv" },
  { key: "cabinet-accessories", label: "Cabinet Accessories", fileName: "cabinet-accessories.csv" },
];

// Canonical plumbing taxonomy: three top-level groups, each with its own
// fixed set of categories. `group` is the group key every category belongs
// to; `all` has no group (it spans every category) and stays first so
// existing "All Plumbing" links keep working.
export const PLUMBING_GROUPS = [
  { key: "kitchen-butlers-pantry", label: "Kitchen / Butler's Pantry" },
  { key: "bathroom-ensuite-powder-room", label: "Bathroom / Ensuite / Powder Room" },
  { key: "laundry", label: "Laundry" },
];

export const PLUMBING_SUBCATEGORIES = [
  { key: "all", label: "All Plumbing", fileName: "plumbing-fixtures-tapware-all.csv", group: "" },
  // Kitchen / Butler's Pantry
  { key: "kitchen-sinks", label: "Kitchen Sinks", fileName: "plumbing-kitchen-sinks.csv", group: "kitchen-butlers-pantry" },
  { key: "kitchen-taps", label: "Kitchen Taps", fileName: "plumbing-kitchen-taps.csv", group: "kitchen-butlers-pantry" },
  { key: "boiling-chilled-filtered", label: "Boiling, Chilled & Filtered Water Taps", fileName: "plumbing-boiling-chilled-filtered.csv", group: "kitchen-butlers-pantry" },
  // Bathroom / Ensuite / Powder Room
  { key: "mixers-tapware", label: "Mixers & Tapware", fileName: "plumbing-mixers-tapware.csv", group: "bathroom-ensuite-powder-room" },
  { key: "showers", label: "Showers", fileName: "plumbing-showers.csv", group: "bathroom-ensuite-powder-room" },
  { key: "bathroom-accessories", label: "Bathroom Accessories", fileName: "plumbing-bathroom-accessories.csv", group: "bathroom-ensuite-powder-room" },
  { key: "toilets", label: "Toilets", fileName: "plumbing-toilets.csv", group: "bathroom-ensuite-powder-room" },
  { key: "basins-bottle-traps", label: "Basins & Bottle Traps", fileName: "plumbing-basins-bottle-traps.csv", group: "bathroom-ensuite-powder-room" },
  { key: "baths-spas", label: "Baths & Spas", fileName: "plumbing-baths-spas.csv", group: "bathroom-ensuite-powder-room" },
  { key: "plugs-wastes", label: "Plugs & Wastes", fileName: "plumbing-plugs-wastes.csv", group: "bathroom-ensuite-powder-room" },
  // Laundry
  { key: "laundry-tubs", label: "Laundry Tubs", fileName: "plumbing-laundry-tubs.csv", group: "laundry" },
  { key: "laundry-tapware", label: "Laundry Tapware", fileName: "plumbing-laundry-tapware.csv", group: "laundry" },
  { key: "laundry-mixers", label: "Laundry Mixers", fileName: "plumbing-laundry-mixers.csv", group: "laundry" },
];

export const LIGHTING_ELECTRICAL_SUBCATEGORIES = [
  { key: "all", label: "All Lighting & Electrical", fileName: "lighting-electrical-all.csv" },
  { key: "interior-lighting", label: "Interior Lighting", fileName: "lighting-interior.csv" },
  { key: "exterior-lighting", label: "Exterior Lighting", fileName: "lighting-exterior.csv" },
  { key: "downlights", label: "Downlights", fileName: "lighting-downlights.csv" },
  { key: "pendant-lights", label: "Pendant Lights", fileName: "lighting-pendant-lights.csv" },
  { key: "wall-lights", label: "Wall Lights", fileName: "lighting-wall-lights.csv" },
  { key: "power-points", label: "Power Points", fileName: "electrical-power-points.csv" },
  { key: "switches", label: "Switches", fileName: "electrical-switches.csv" },
  { key: "fans", label: "Fans", fileName: "electrical-fans.csv" },
  { key: "smoke-alarms", label: "Smoke Alarms", fileName: "electrical-smoke-alarms.csv" },
  { key: "electrical-appliances-accessories", label: "Electrical Appliances/Accessories", fileName: "electrical-appliances-accessories.csv" },
];

export const CATALOGUE_GROUP_SUBCATEGORIES = {
  roofing: EXTERIOR_CATALOGUE_SECTIONS.roofing.map(([key, label]) => ({ key, label, fileName: `roofing-${key}.csv` })),
  [CABINETRY_SECTION_KEY]: CABINETRY_SUBCATEGORIES,
  [PLUMBING_SECTION_KEY]: PLUMBING_SUBCATEGORIES,
  [LIGHTING_ELECTRICAL_SECTION_KEY]: LIGHTING_ELECTRICAL_SUBCATEGORIES,
};

const SECTION_EXPORT_FILE_NAMES = {
  appliances: "appliances-white-goods.csv",
  [CABINETRY_SECTION_KEY]: "cabinetry-all.csv",
  [PLUMBING_SECTION_KEY]: "plumbing-fixtures-tapware-all.csv",
  "doors-door-furniture": "doors-door-furniture.csv",
  windows: "windows.csv",
  roofing: "roofing.csv",
  cladding: "cladding.csv",
  flooring: "flooring.csv",
  tiles: "tiles.csv",
  painting: "painting.csv",
  [LIGHTING_ELECTRICAL_SECTION_KEY]: "lighting-electrical-all.csv",
  "fix-out": "fix-out.csv",
  "external-products": "external-products.csv",
};

export function cabinetrySubcategoryForProduct(product = {}) {
  const assignedCategory = CABINETRY_SUBCATEGORIES.find((item) => item.label === product.categoryKey);
  if (assignedCategory) return assignedCategory.key;
  const familyKey = product.familyKey || product.familyId || "";
  const attributes = product.attributes || {};
  const canonicalType = String(attributes.canonicalType || attributes.categoryType || "").toLowerCase();
  const productType = String(product.productType || product.product_type || attributes.productType || "").toLowerCase();
  const text = [
    product.categoryKey,
    product.category,
    product.categoryId,
    product.section,
    product.sectionName,
    product.range,
    product.collection,
    product.productName,
    product.model,
    product.sku,
    product.productCode,
    product.description,
    product.sourceName,
    product.sourceType,
    attributes.fixtureType,
    attributes.handleUse,
    attributes.choiceType,
    attributes.productApplication,
    attributes.application,
    attributes.quotationMappingId,
  ].filter(Boolean).join(" ").toLowerCase();
  if (/oven|cooktop|rangehood|dishwasher|microwave|fridge|refrigerat|appliance/.test(familyKey) || /appliance catalogue|appliance pack|white goods/.test(text)) return "";
  if (["entry-doors", "garage-doors", "internal-doors", "door-hardware"].includes(familyKey)) return "";
  if (/entry door|external door|garage door|internal door|door furniture|mortice lock|deadbolt|smart lock|digital lock|door closer/.test(text)) return "";
  if (["stone-benchtops", "stone-20mm-tops", "stone-40mm-tops"].includes(familyKey) || /benchtop|stone benchtop|caesarstone|smartstone|neolith|stone ambassador/.test(text)) return "cabinet-benchtops";
  if (familyKey === "cabinet-finish" || canonicalType === "finish_product" || productType === "cabinet-finish" || /cabinet finish|board colour|board color|laminex|polytec|decorated panel|decorative board|colour collection/.test(text)) return "board-colours-finishes";
  if (familyKey === "handles") return /entry|external|door/.test(text) ? "" : "cabinet-handles";
  if (canonicalType === "handle_product" || productType === "handles" || /cabinet handle|handle house|pull handle|finger pull|sharkfin|channel pull/.test(text)) return /entry|external|door furniture/.test(text) ? "" : "cabinet-handles";
  if (canonicalType === "hardware_product" || productType === "hardware" || /blum|hinge|runner|hardware|soft-close|soft close|drawer runner|cabinet hardware/.test(text)) return "cabinet-hardware";
  if (canonicalType === "cabinet_unit" || productType === "cabinetry" || /cabinet unit|base unit|wall unit|overhead|pantry|vanity|cupboard|cabinet product|cabinetry product/.test(text)) return "cabinetry-products";
  if (/cabinet door|door panel|drawer front|end panel|appliance panel|kick panel|doors & panels|doors and panels/.test(text)) return "cabinet-doors-panels";
  if (familyKey === "cabinetry") return "cabinet-accessories";
  if (/cabinet|cabinetry|joinery|cleated shelving|bulkhead|shelving/.test(text)) return "cabinet-accessories";
  return "";
}

export function productBelongsToCabinetryCatalogue(product = {}) {
  return cabinetrySubcategoryForProduct(product) !== "";
}

export function productMatchesCabinetrySubcategory(product = {}, subcategoryKey = "all") {
  if (subcategoryKey === "cabinetry-products") return product.categoryKey === "Cabinetry Products";
  if (!productBelongsToCabinetryCatalogue(product)) return false;
  if (!subcategoryKey || subcategoryKey === "all") return true;
  return cabinetrySubcategoryForProduct(product) === subcategoryKey;
}

function catalogueProductText(product = {}) {
  const attributes = product.attributes || {};
  return [
    product.familyKey,
    product.familyId,
    product.categoryKey,
    product.category,
    product.categoryId,
    product.section,
    product.sectionName,
    product.range,
    product.collection,
    product.productName,
    product.model,
    product.sku,
    product.productCode,
    product.description,
    product.sourceName,
    product.productType,
    attributes.fixtureType,
    attributes.handleUse,
    attributes.choiceType,
    attributes.productApplication,
    attributes.application,
    attributes.canonicalType,
    attributes.categoryType,
    attributes.quotationMappingId,
    attributes.quotationLineCategory,
  ].filter(Boolean).join(" ").toLowerCase();
}

// Family keys that must never resolve into Plumbing, no matter what generic
// merchandising words ("accessories", boilerplate "bathroom" room tags, etc.)
// show up in their name/description/range text. This is the fix for the
// root-cause bug: cabinetry and door-hardware/entry-door-furniture products
// were reaching the loose keyword regexes below with no family guard at all,
// so a Lockwood lever whose description happened to mention "latches and
// accessories are included..." or a bathroom-located cabinet unit whose
// description said "...for bathroom, ensuite..." (which contains the bare
// substring "bath") matched and got swept into Plumbing.
const NON_PLUMBING_FAMILY_KEYS = new Set([
  "cabinetry", "cabinet-finish", "handles",
  "laminate-benchtops", "stone-benchtops", "stone-20mm-tops", "stone-40mm-tops",
  "door-hardware", "entry-door-furniture", "entry-doors", "garage-doors", "internal-doors",
  "windows", "bricks", "feature-bricks", "cladding", "roofing", "gutters-fascia",
  "lighting", "external-lighting", "electrical", "electrical-fixtures",
  "flooring", "tiles", "floor-tiles", "wall-tiles", "feature-tiles",
  "paint", "exterior-paint",
]);
const NON_PLUMBING_TEXT = /door hardware|door furniture|entry door|external door|garage door|internal door|mortice|deadbolt|lockset|door handle|door lever|round rose|cabinet|cabinetry|joinery|stone benchtop|caesarstone|smartstone|neolith|laminex|polytec/;
// Plumbing family keys that are trusted outright: once a record is genuinely
// tagged with one of these, the text-based exclusion above is skipped so an
// incidental word like "benchtop" in a legitimate accessory's own copy (e.g.
// a "benchtop drainer basket" kitchen-sink accessory) can't knock it out.
const TRUSTED_PLUMBING_FAMILY_KEYS = new Set([
  "kitchen-sinks", "kitchen-sink-mixers", "basin", "basin-mixer", "bath", "toilet",
  "tapware", "shower-screen", "shower-mixer", "shower-outlet", "vanity", "accessories",
  "boiling-chilled-filtered-tap",
]);

const PLUMBING_CANONICAL_CATEGORY_KEYS = new Set(PLUMBING_SUBCATEGORIES.map((item) => item.key).filter((key) => key !== "all"));

// A trusted/canonical family_key can still be wrong when its own source file
// bundles a genuine accessory under a blanket family tag alongside the real
// product it's named for - e.g. AU-KITCHEN-SINK-CATALOGUE.json tags every
// row "kitchen-sinks", including a handful of sink mixers, a tap spout, and
// several sink wastes it bundles alongside real sinks; HNC's own /kitchen/
// sinks listing likewise mixes food waste disposers in with sinks. Catch
// these obvious mismatches and route them through the ordinary keyword
// logic below instead of trusting the family tag at face value.
const KITCHEN_SINKS_MISCLASSIFICATION_TEXT = /\bsink mixer\b|\bswivel sink spout\b|\bhob swivel\b|\bsink waste\b|\bbasket waste\b|\bwaste (and|&) overflow\b|\bwaste cover\b|food waste dispos/i;

export function plumbingSubcategoryForProduct(product = {}) {
  const rawFamilyKey = product.familyKey || product.familyId || "";
  const text = catalogueProductText(product);
  if (rawFamilyKey === "kitchen-sinks" && KITCHEN_SINKS_MISCLASSIFICATION_TEXT.test(text)) {
    // Route straight to the right destination rather than falling through
    // the generic chain below: `text` also carries this row's own category/
    // source labels ("...Kitchen Sinks listing"), which would just re-match
    // the "kitchen sink" keyword check further down and undo this override.
    if (/\bsink waste\b|\bbasket waste\b|\bwaste (and|&) overflow\b|\bwaste cover\b|food waste dispos/.test(text)) return "plugs-wastes";
    return "kitchen-taps"; // sink mixer / swivel sink spout
  }
  const familyKey = rawFamilyKey;
  // HNC-sourced plumbing rows are tagged directly with their canonical
  // category key (e.g. "kitchen-taps", "baths-spas") at import time, so they
  // never need to pass through the keyword heuristics below at all.
  if (PLUMBING_CANONICAL_CATEGORY_KEYS.has(familyKey)) return familyKey;
  if (NON_PLUMBING_FAMILY_KEYS.has(familyKey)) return "";
  if (/oven|cooktop|rangehood|dishwasher|microwave|fridge|refrigerat|appliance/.test(familyKey)) return "";
  if (!TRUSTED_PLUMBING_FAMILY_KEYS.has(familyKey) && (/appliance catalogue|appliance pack|white goods/.test(text) || NON_PLUMBING_TEXT.test(text))) return "";

  const roomText = [product.topLevelArea, product.top_level_area, ...(Array.isArray(product.attributes?.applicableRooms) ? product.attributes.applicableRooms : [])]
    .filter(Boolean).join(" ").toLowerCase();
  const isLaundry = /laundry/.test(roomText) || /laundry/.test(text);
  const isKitchen = !isLaundry && (/kitchen|butler/.test(roomText) || /kitchen/.test(text));

  // Word-boundary-guarded from here on: `\bbath\b` matches "bath" and "bath tap"
  // but never the substring inside "bathroom", fixing the other half of the bug.
  if (familyKey === "toilet" || /\btoilet\b|wc suite|toilet suite/.test(text)) return "toilets";
  if (familyKey === "boiling-chilled-filtered-tap" || /boiling water tap|chilled water tap|filtered water tap|instant boiling|3-in-1 tap|4-in-1 tap|zip tap|billi tap/.test(text)) return "boiling-chilled-filtered";
  if (isLaundry && (familyKey === "kitchen-sinks" || /laundry tub|wash tub|laundry trough/.test(text))) return "laundry-tubs";
  if (familyKey === "kitchen-sinks" || (/kitchen sink|sink bowl|flushline sink/.test(text) && !/mixer|\btap\b|spout/.test(text))) return "kitchen-sinks";
  if (/\bbottle trap\b|\bbasin waste\b|\bsink waste\b|\bbasket waste\b|\bpop-?up waste\b|\bplug and waste\b|\bfloor waste\b|\bwaste (and|&) overflow\b|\bwaste cover\b|food waste dispos/.test(text)) return "plugs-wastes";
  if (familyKey === "basin" || (/\bbasin\b/.test(text) && !/mixer|tap/.test(text))) return "basins-bottle-traps";
  if (familyKey === "bath" || (/\bbath\b|\bspa\b/.test(text) && !/mixer|tap/.test(text))) return "baths-spas";
  if (familyKey === "shower-screen" || /shower screen|shower panel/.test(text)) return "showers";
  if (familyKey === "shower-mixer" || familyKey === "shower-outlet" || /shower mixer|shower outlet|shower head|hand shower|rail shower|shower rail|shower rose/.test(text)) return "showers";
  if (isLaundry && (familyKey === "kitchen-sink-mixers" || /laundry mixer|laundry tap/.test(text))) return /laundry mixer/.test(text) ? "laundry-mixers" : "laundry-tapware";
  if (isKitchen && (familyKey === "kitchen-sink-mixers" || /sink mixer|kitchen mixer|kitchen tap/.test(text))) return "kitchen-taps";
  if (familyKey === "basin-mixer" || /basin mixer|bath mixer|bath tap|bidet mixer/.test(text)) return "mixers-tapware";
  if (familyKey === "kitchen-sink-mixers" || familyKey === "tapware" || /mixer|tapware|\btap\b/.test(text)) return isLaundry ? "laundry-tapware" : isKitchen ? "kitchen-taps" : "mixers-tapware";
  if (["vanity", "accessories"].includes(familyKey) || /bathroom accessor|towel rail|robe hook|toilet roll holder|soap dish|soap holder|grab rail|shower caddy/.test(text)) return "bathroom-accessories";
  return "";
}

export function lightingElectricalSubcategoryForProduct(product = {}) {
  const familyKey = product.familyKey || product.familyId || "";
  const text = catalogueProductText(product);
  if (!["lighting", "external-lighting", "electrical", "electrical-fixtures"].includes(familyKey) && !/light|downlight|pendant|wall light|power point|switch|fan|smoke alarm|electrical/.test(text)) return "";
  if (familyKey === "external-lighting" || /external|exterior|outdoor|alfresco/.test(text) && /light/.test(text)) return "exterior-lighting";
  if (/downlight/.test(text)) return "downlights";
  if (/pendant/.test(text)) return "pendant-lights";
  if (/wall light|wall sconce/.test(text)) return "wall-lights";
  if (/power point|gpo|outlet/.test(text)) return "power-points";
  if (/switch/.test(text)) return "switches";
  if (/fan|ceiling fan|exhaust fan/.test(text)) return "fans";
  if (/smoke alarm|smoke detector/.test(text)) return "smoke-alarms";
  if (/appliance|accessor|electrical/.test(text) && !/light/.test(text)) return "electrical-appliances-accessories";
  return "interior-lighting";
}

export function catalogueSubcategoryForProduct(product = {}, sectionKey = "") {
  if (sectionKey === "roofing") return exteriorSectionForProduct(product, "roofing");
  if (sectionKey === CABINETRY_SECTION_KEY) return cabinetrySubcategoryForProduct(product);
  if (sectionKey === PLUMBING_SECTION_KEY) return plumbingSubcategoryForProduct(product);
  if (sectionKey === LIGHTING_ELECTRICAL_SECTION_KEY) return lightingElectricalSubcategoryForProduct(product);
  return "";
}

export function productBelongsToCatalogueSection(product = {}, sectionItem = null) {
  if (!sectionItem) return false;
  if (sectionItem.key === CABINETRY_SECTION_KEY || sectionItem.key === PLUMBING_SECTION_KEY || sectionItem.key === LIGHTING_ELECTRICAL_SECTION_KEY) {
    return catalogueSubcategoryForProduct(product, sectionItem.key) !== "";
  }
  const familyKey = product.familyKey || product.familyId || "";
  return new Set(sectionItem.familyKeys || []).has(familyKey);
}

export function productMatchesCatalogueSubcategory(product = {}, sectionKey = "", subcategoryKey = "all") {
  if (sectionKey === CABINETRY_SECTION_KEY && subcategoryKey === "cabinetry-products") return product.categoryKey === "Cabinetry Products";
  if (!subcategoryKey || subcategoryKey === "all") return true;
  return catalogueSubcategoryForProduct(product, sectionKey) === subcategoryKey;
}

export function catalogueSectionExportFileName(sectionItem = null) {
  if (!sectionItem) return "product-library-section.csv";
  return SECTION_EXPORT_FILE_NAMES[sectionItem.key] || `${slugify(sectionItem.displayName)}.csv`;
}
