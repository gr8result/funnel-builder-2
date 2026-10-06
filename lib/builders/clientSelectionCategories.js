// Client Selections navigation: INTERIOR / EXTERIOR, then PRODUCT / TRADE categories, never rooms.
//
//   Client Selections -> Interior | Exterior -> category -> product -> quantity / location
//
// Rooms (Kitchen, Bathroom, Ensuite, Laundry, ...) are allocation data - where a selected product
// is installed and how many - never navigation. Each category points at the requirement(s) that
// already own the selection, so nothing is selected twice:
//
//   route "area"        - an existing multi-step workflow (Appliances)
//   route "requirement" - a single requirement with its own workflow (Cabinetry, Windows, ...)
//   route "hub"         - a category landing listing its requirements (Plumbing, Accessories, ...)
//
// A category can appear on both the Interior and Exterior pages (Solar), and an exterior card can
// open a requirement an interior category also lists (Balustrades). Both are entry points to the
// SAME requirement and the same canonical Product Library products - never a copy.
//
// standardInclusionSections: the Standard Inclusions schedule sections (Classic / Premier /
// Premium) whose starting specification this category overrides for the PROJECT only - the
// master schedules are never written by Client Selections.
//
// selectionModel records WHAT kind of selection the category is, so the estimate / quotation
// mapping can treat it correctly (a paint colour is not a product; a glass balustrade is a system
// priced per LM; tiles are a product priced per m² with Takeoff quantities).

import { bathroomAccessoryTypeByKey } from "../product-library/bathroomAccessoryDiscovery.js";

export const CLIENT_SELECTION_SIDES = [
  { key: "interior", label: "Interior" },
  { key: "exterior", label: "Exterior" },
];

export const CLIENT_SELECTION_CATEGORY_GROUPS = [
  { key: "kitchen-bath", side: "interior", label: "Kitchen & Bathroom" },
  { key: "interior-finishes", side: "interior", label: "Interior Finishes" },
  { key: "services", side: "interior", label: "Services & Technology" },
  { key: "exterior-envelope", side: "exterior", label: "Doors, Windows, Roof & Walls" },
  { key: "exterior-living", side: "exterior", label: "Outdoor Living & Accessories" },
  { key: "exterior-optional", side: "exterior", label: "Optional Scope" },
  // Always last on the Exterior page: energy systems follow the building-envelope selections.
  { key: "exterior-energy", side: "exterior", label: "Solar, Batteries & EV Charging" },
];

const category = (key, label, sides, group, route, requirementKeys, extra = {}) => ({ key, label, sides, group, route, requirementKeys, ...extra });
const INTERIOR = ["interior"];
const EXTERIOR = ["exterior"];

export const CLIENT_SELECTION_CATEGORIES = [
  // INTERIOR - Kitchen & Bathroom
  category("cabinetry", "Cabinetry & Benchtops", INTERIOR, "kitchen-bath", "requirement", ["cabinetry"], { standardInclusionSections: ["Kitchen", "Laundry", "Bathroom, Ensuite & WC"], selectionModel: "configuration", estimateSection: "CABINETRY", description: "Doors, panels, handles and benchtops for every cabinetry location." }),
  category("appliances", "Appliances", INTERIOR, "kitchen-bath", "area", ["oven", "cooktop", "rangehood", "dishwasher", "microwave", "fridge", "freestanding-cooker", "appliance-pack"], { areaKey: "appliances", standardInclusionSections: ["Kitchen"], selectionModel: "product", estimateSection: "APPLIANCES", description: "Oven, cooktop, rangehood, dishwasher, microwave and packages." }),
  category("plumbing-fixtures", "Plumbing Fixtures & Tapware", INTERIOR, "kitchen-bath", "hub", ["sink", "sink-mixer", "bathroom-basin", "basin-mixer", "bath", "bath-mixer", "bath-spout", "shower-fixtures", "toilet-suite", "laundry-tub"], { standardInclusionSections: ["Kitchen", "Bathroom, Ensuite & WC", "Laundry", "Plumbing & Drainage"], selectionModel: "product", estimateSection: "PLUMBING FIT OFF", description: "Sinks, basins, baths, tapware, showers and toilets, allocated to rooms." }),
  category("bathroom-accessories", "Bathroom Accessories", INTERIOR, "kitchen-bath", "hub", ["towel-rail", "hand-towel", "toilet-roll-holder", "robe-hook", "shower-shelf", "toilet-brush"], { discoveryArea: "bathroom-accessories", standardInclusionSections: ["Bathroom, Ensuite & WC"], selectionModel: "product", estimateSection: "FIX OUT - BATHROOM ACCESSORIES", description: "Bathroom accessory types and products available in the Product Library." }),
  category("shower-screens-mirrors", "Shower Screens & Mirrors", INTERIOR, "kitchen-bath", "hub", ["shower-screen", "mirror", "shaving-cabinet"], { standardInclusionSections: ["Bathroom, Ensuite & WC"], selectionModel: "configuration", estimateSection: "SHOWER SCREENS & MIRRORS", description: "Shower screens configured per shower, mirrors and shaving cabinets - all from the Product Library." }),
  category("tiles-stone", "Tiles & Stone", INTERIOR, "kitchen-bath", "hub", ["tiling-rooms"], { standardInclusionSections: ["Bathroom, Ensuite & WC", "Kitchen", "Laundry", "Internal"], selectionModel: "product-per-m2", estimateSection: "TILING", description: "Floor, wall, feature and external tiles, mosaics, and floor wastes & drains." }),

  // INTERIOR - Finishes
  // Flooring opens its own area workflow (FlooringSelectionWorkflow): Product Library flooring by
  // type, colour per floor area, whole-pack ordering.
  category("flooring", "Flooring", INTERIOR, "interior-finishes", "hub", ["interior-flooring"], { standardInclusionSections: ["Internal"], selectionModel: "product-per-m2", estimateSection: "FLOOR COVERINGS", description: "Timber, hybrid, vinyl and carpet floor coverings." }),
  category("internal-doors", "Internal Doors & Hardware", INTERIOR, "interior-finishes", "hub", ["internal-doors", "door-hardware"], { standardInclusionSections: ["Internal", "Windows, Doors & Locks"], selectionModel: "product", estimateSection: "INTERNAL DOORS", description: "Internal door styles and door furniture." }),
  category("fix-out", "Fix-Out Items", INTERIOR, "interior-finishes", "hub", ["skirting", "architraves"], { standardInclusionSections: ["Internal", "Robes & Linen Cupboards"], selectionModel: "configuration", estimateSection: "FIX OUT", description: "Skirting, architraves, reveals and shelving profiles." }),
  category("wardrobes", "Wardrobe Systems", INTERIOR, "interior-finishes", "requirement", ["robes"], { standardInclusionSections: ["Robes & Linen Cupboards"], selectionModel: "configuration", estimateSection: "WARDROBES", description: "Robe doors, shelving and wardrobe fit-out." }),
  category("stairs-balustrades", "Stairs & Balustrades", INTERIOR, "interior-finishes", "hub", ["stairs", "balustrades"], { standardInclusionSections: ["Internal", "Structural & External"], selectionModel: "system", estimateSection: "STAIRS & BALUSTRADES", fixedRequirements: true, description: "Stair configuration and balustrade systems priced per LM or system." }),
  category("paint-wall-finishes", "Paint & Wall Finishes", INTERIOR, "interior-finishes", "requirement", ["interior-paint"], { standardInclusionSections: ["Painting"], selectionModel: "colour", estimateSection: "PAINTING", description: "Wall, ceiling, trim, door and feature colours." }),

  // INTERIOR - Services & Technology
  // Electrical is a quantity schedule, room by room (ElectricalScheduleWorkflow): no products.
  // Light fittings and fans ARE products and are selected in Lighting & Ceiling Fans only.
  category("electrical-technology", "Electrical", INTERIOR, "services", "hub", ["electrical-schedule"], { standardInclusionSections: ["Electrical"], selectionModel: "quantity-schedule", estimateSection: "ELECTRICAL", description: "How many power, data, TV and appliance points each room needs." }),
  category("lighting-fans", "Lighting & Ceiling Fans", INTERIOR, "services", "hub", ["interior-lighting", "ceiling-fan"], { standardInclusionSections: ["Electrical"], selectionModel: "product", estimateSection: "ELECTRICAL - LIGHTING", description: "Downlights, pendants, feature and wall lights, and ceiling fans for each room." }),
  category("hvac", "HVAC / Air Conditioning", INTERIOR, "services", "hub", ["air-conditioning", "indoor-heating"], { standardInclusionSections: ["Energy & Comfort"], selectionModel: "system", estimateSection: "AIR CONDITIONING", description: "Air conditioning systems, heaters and fireplaces." }),
  category("hot-water", "Hot Water Systems", INTERIOR, "services", "hub", ["hot-water-system"], { standardInclusionSections: ["Plumbing & Drainage", "Energy & Comfort"], selectionModel: "product", estimateSection: "PLUMBING - HOT WATER", description: "Electric, heat pump, gas continuous flow and solar." }),
  category("solar-batteries", "Solar & Batteries", ["interior", "exterior"], "services", "hub", ["solar-system", "home-battery", "ev-charger"], { groupBySide: { exterior: "exterior-energy" }, standardInclusionSections: ["Energy & Comfort", "Electrical"], selectionModel: "system", estimateSection: "SOLAR & ELECTRICAL", description: "Solar PV systems, home batteries and EV chargers." }),

  // EXTERIOR - Doors, Windows, Roof & Walls
  category("external-doors", "External Doors & Hardware", EXTERIOR, "exterior-envelope", "requirement", ["entry-door"], { standardInclusionSections: ["Windows, Doors & Locks"], selectionModel: "configuration", estimateSection: "EXTERNAL DOORS", description: "Entry doors, handles, locks and hardware." }),
  category("windows-glazing", "Windows / Glazing", EXTERIOR, "exterior-envelope", "requirement", ["windows"], { standardInclusionSections: ["Windows, Doors & Locks"], selectionModel: "configuration", estimateSection: "WINDOWS", description: "Frame colour, glass and screens." }),
  category("external-cladding", "External Cladding & Finishes", EXTERIOR, "exterior-envelope", "hub", ["bricks", "cladding"], { standardInclusionSections: ["Structural & External", "External Finishes"], selectionModel: "configuration", estimateSection: "EXTERNAL FINISHES", description: "Bricks, render and lightweight cladding." }),
  category("roofing", "Roofing / Gutters / Fascia", EXTERIOR, "exterior-envelope", "requirement", ["roofing"], { standardInclusionSections: ["Roofing"], selectionModel: "configuration", estimateSection: "ROOFING", description: "Roof profile and colour, gutters, fascia and downpipes." }),
  category("external-paint", "External Paint / Colours", EXTERIOR, "exterior-envelope", "requirement", ["exterior-paint"], { standardInclusionSections: ["Painting", "External Finishes"], selectionModel: "colour", estimateSection: "EXTERNAL FINISHES", description: "The exterior colour schedule." }),
  category("garage-doors", "Garage Doors", EXTERIOR, "exterior-envelope", "requirement", ["garage-door"], { standardInclusionSections: ["Windows, Doors & Locks", "External Finishes"], selectionModel: "configuration", estimateSection: "GARAGE DOORS", description: "Door type, profile, colour and motor." }),

  // EXTERIOR - Outdoor living & accessories
  category("outdoor-living", "Outdoor Living", EXTERIOR, "exterior-living", "hub", ["built-in-bbq", "outdoor-kitchen", "bbq-rangehood", "pizza-oven"], { standardInclusionSections: ["External Finishes"], selectionModel: "product", estimateSection: "OUTDOOR KITCHEN", description: "Built-in BBQs, outdoor kitchens and alfresco appliances." }),
  category("external-lighting", "External Lighting", EXTERIOR, "exterior-living", "requirement", ["external-lighting"], { standardInclusionSections: ["Electrical"], selectionModel: "product", estimateSection: "ELECTRICAL - LIGHTING", description: "Wall, entry, garden and sensor lighting." }),
  category("balustrades", "Balustrades", EXTERIOR, "exterior-living", "requirement", ["balustrades"], { standardInclusionSections: ["Structural & External"], selectionModel: "system", estimateSection: "STAIRS & BALUSTRADES", description: "Balcony, deck and upper-level balustrade systems." }),
  category("external-accessories", "External Accessories", EXTERIOR, "exterior-living", "hub", ["clothesline", "letterbox", "house-numbers"], { standardInclusionSections: ["External Finishes"], selectionModel: "product", estimateSection: "EXTERNAL ACCESSORIES", description: "Clotheslines, letterboxes, parcel boxes and house numbers." }),

  // EXTERIOR - project dependent
  category("landscaping-optional", "Driveway, Decking & Landscaping", EXTERIOR, "exterior-optional", "hub", ["driveway", "decking", "pool", "retaining-walls", "landscaping"], { standardInclusionSections: ["Driveway", "External Finishes"], selectionModel: "configuration", estimateSection: "EXTERNAL WORKS", description: "Project-dependent: only what this build includes." }),
];

// A requirement whose downstream estimate section differs from its category's.
export const REQUIREMENT_ESTIMATE_SECTIONS = {
  "floor-waste": "PLUMBING - FLOOR WASTES & DRAINS",
};

export const CLIENT_SELECTION_CATEGORY_BY_KEY = Object.fromEntries(CLIENT_SELECTION_CATEGORIES.map((item) => [item.key, item]));

export function categoryGroupForSide(item = {}, side = "") {
  return item.groupBySide?.[side] || item.group;
}

export function clientSelectionCategoriesForSide(side = "") {
  return CLIENT_SELECTION_CATEGORIES.filter((item) => item.sides.includes(side));
}

export function clientSelectionCategoryForRequirement(requirementKey = "", side = "") {
  if (bathroomAccessoryTypeByKey(requirementKey)) return CLIENT_SELECTION_CATEGORY_BY_KEY["bathroom-accessories"];
  const matches = CLIENT_SELECTION_CATEGORIES.filter((item) => item.requirementKeys.includes(requirementKey));
  return (side && matches.find((item) => item.sides.includes(side))) || matches[0] || null;
}

export function requirementsForSelectionCategory(category = {}, requirements = []) {
  if (category.discoveryArea) return requirements.filter((item) => item.areaKey === category.discoveryArea);
  const byKey = new Map(requirements.map((item) => [item.requirementKey, item]));
  return (category.requirementKeys || []).map((key) => byKey.get(key)).filter(Boolean);
}

export function estimateSectionForRequirement(requirementKey = "") {
  return REQUIREMENT_ESTIMATE_SECTIONS[requirementKey] || clientSelectionCategoryForRequirement(requirementKey)?.estimateSection || "CLIENT SELECTIONS";
}

// Within one side every requirement belongs to exactly one category (no duplicate selection points
// on the same page). Across sides a shared entry point (Balustrades) is allowed: it opens the same
// requirement.
export function duplicateCategoryRequirementKeys() {
  const duplicates = [];
  CLIENT_SELECTION_SIDES.forEach(({ key: side }) => {
    const seen = new Map();
    clientSelectionCategoriesForSide(side).forEach((item) => item.requirementKeys.forEach((requirementKey) => {
      if (seen.has(requirementKey)) duplicates.push({ side, key: requirementKey, categories: [seen.get(requirementKey), item.key] });
      else seen.set(requirementKey, item.key);
    }));
  });
  return duplicates;
}
