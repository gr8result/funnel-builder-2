import laminexCabinetryColours from "../../data/product-library/catalogues/cabinetry/AU-LAMINEX-CABINETRY-COLOURS.js";
import polytecCabinetryColours from "../../data/product-library/catalogues/cabinetry/AU-POLYTEC-CABINETRY-COLOURS.js";
import stoneBenchtopCatalogue from "../../data/product-library/catalogues/benchtops/AU-STONE-BENCHTOP-CATALOGUE.js";
import polytecLaminateBenchtops from "../../data/product-library/catalogues/benchtops/AU-POLYTEC-LAMINATE-BENCHTOPS.js";
import laminexLaminateBenchtops from "../../data/product-library/catalogues/benchtops/AU-LAMINEX-LAMINATE-BENCHTOPS.js";
import { DEFAULT_CABINETRY_FINISH, getCabinetryUnitRate } from "./cabinetryUnitRates.js";

export const PRODUCT_LIBRARY_CABINETRY_ROOM_IDS = [
  "kitchen",
  "butlers-pantry",
  "pantry",
  "kitchenette",
  "bathroom",
  "ensuite",
  "powder-room",
  "laundry",
  "bedrooms",
  "living-areas",
  "internal-areas",
];

export const PRODUCT_LIBRARY_CABINETRY_CATEGORY_ASSETS = {
  "cabinet-doors-panels": {
    image: "/images/catalogues/product-library/categories/cabinet-doors-panels-standard-base-cupboards.jpg",
    sourceUrl: "https://unsplash.com/photos/3bb406ef7e77",
    attribution: "Unsplash photo used as a cabinetry category card only; not a product swatch.",
  },
  "cabinet-handles": {
    image: "/images/catalogues/product-library/categories/cabinet-handles-handle-house-c3.jpg",
    sourceUrl: "https://handlehouse.com.au/products/c3-post-and-rail-cabinet-handles",
    attribution: "Handle House C3 Post and Rail product image.",
  },
};

export const PRODUCT_LIBRARY_CABINETRY_BRAND_ASSETS = {
  Laminex: {
    logo: "/images/catalogues/product-library/brands/laminex-logo.jpg",
    sourceUrl: "https://brandfetch.com/laminex.com.au",
    officialUrl: "https://www.laminex.com.au/",
  },
  Polytec: {
    logo: "/images/catalogues/product-library/brands/polytec-logo.jpg",
    sourceUrl: "https://brandfetch.com/polytec.com.au",
    officialUrl: "https://www.polytec.com.au/",
  },
};

export const PRODUCT_LIBRARY_CABINETRY_LOCATION_OPTIONS = ["Kitchen", "Butler's Pantry", "Bathroom", "Ensuite", "Powder Room", "Laundry", "Other"];

export const PRODUCT_LIBRARY_CABINETRY_AREA_KEYS = [
  "lowerDoorsDrawers",
  "overheadDoors",
  "islandBenchBack",
  "endPanels",
  "tallPantryDoors",
  "kickPanels",
  "bulkheads",
  "cabinetInteriors",
  "openShelving",
  "featurePanels",
  "floorVanityDoors",
  "floorVanityDrawers",
  "floorVanityTowelDisplay",
  "wallVanityDoors",
  "wallVanityDrawers",
  "wallVanityTowelDisplay",
  "tallLinenDoors",
  "tallLinenEndPanels",
  "linenBulkhead",
  "bathroomOtherCustom",
];

export const PRODUCT_LIBRARY_CABINETRY_AREA_LABELS = {
  lowerDoorsDrawers: "Lower base-unit doors",
  overheadDoors: "Overheads",
  islandBenchBack: "Island bench back",
  endPanels: "End panels",
  tallPantryDoors: "Tall pantry doors",
  kickPanels: "Kick panels",
  bulkheads: "Bulkheads",
  cabinetInteriors: "Cabinet interiors",
  openShelving: "Open shelving",
  featurePanels: "Feature panels",
  floorVanityDoors: "Floor-mounted vanity doors",
  floorVanityDrawers: "Floor-mounted vanity drawer fronts",
  floorVanityTowelDisplay: "Floor-mounted vanity towel display",
  wallVanityDoors: "Wall-mounted vanity doors",
  wallVanityDrawers: "Wall-mounted vanity drawer fronts",
  wallVanityTowelDisplay: "Wall-mounted vanity towel display",
  tallLinenDoors: "Tall linen cupboard doors",
  tallLinenEndPanels: "Tall linen cupboard end panels",
  linenBulkhead: "Bulkhead over tall linen cupboard",
  bathroomOtherCustom: "Other/custom",
};

// Kick panels and bulkheads are deliberately excluded here: they have dedicated Kick-panel Finish
// and Bulkhead Finish sections later in the Colours & Finishes stage, which are authoritative for
// their completeness. Listing them here as well used to force a second, duplicate colour pick.
export const PRODUCT_LIBRARY_CABINETRY_LOCATION_AREA_KEYS = [
  "lowerDoorsDrawers",
  "islandBenchBack",
  "endPanels",
  "overheadDoors",
];

export const PRODUCT_LIBRARY_WET_AREA_CABINETRY_ROOM_NAMES = ["bathroom", "ensuite", "powder room"];

export const PRODUCT_LIBRARY_WET_AREA_CABINETRY_AREA_KEYS = [
  "floorVanityDoors",
  "floorVanityDrawers",
  "floorVanityTowelDisplay",
  "wallVanityDoors",
  "wallVanityDrawers",
  "wallVanityTowelDisplay",
  "tallLinenDoors",
  "tallLinenEndPanels",
  "linenBulkhead",
  "bathroomOtherCustom",
];

// There is no Scope step: the Cabinet Schedule defines what cabinetry a room has.
export const PRODUCT_LIBRARY_CABINETRY_WORKFLOW_STAGES = [
  "Cabinet Schedule",
  "Doors & Panels",
  "Colours & Finishes",
  "Benchtops",
  "Handles",
  "Features",
  "Review & Confirm",
];

export const PRODUCT_LIBRARY_CABINETRY_PRICING_TIERS = [
  { key: "tier_1", label: "Tier 1 - Included/standard", methods: ["per_door", "per_drawer_front", "per_panel", "per_square_metre", "per_linear_metre", "package"], status: "included" },
  { key: "tier_2", label: "Tier 2 - Upgraded decorative", methods: ["per_door", "per_drawer_front", "per_panel", "per_square_metre", "package"], status: "upgrade" },
  { key: "tier_3", label: "Tier 3 - Premium gloss or specialty", methods: ["per_door", "per_drawer_front", "per_panel", "per_square_metre", "package"], status: "quote_required" },
  { key: "tier_4", label: "Tier 4 - Profiled/thermolaminated", methods: ["per_door", "per_drawer_front", "per_panel", "package"], status: "quote_required" },
  { key: "tier_5", label: "Tier 5 - Custom two-pack", methods: ["per_door", "per_drawer_front", "per_panel", "package"], status: "quote_required" },
];

export const PRODUCT_LIBRARY_CABINETRY_DOOR_MATERIAL_GROUPS = [
  "Flat standard colour board",
  "Premium decorative board",
  "Gloss decorative board",
  "Thermolaminated/vinyl-wrap doors",
  "Shaker/profiled doors",
  "Two-pack painted doors",
  "Other/custom",
];

// One option per finish block of the approved quotation catalogue, plus Other/custom (quote required).
export const PRODUCT_LIBRARY_CABINETRY_MATERIAL_OPTIONS = ["Standard colourboard", "Premium laminate", "Two-pack painted", "Shaker/profile door", "Vinyl wrap", "Other/custom"];
export const PRODUCT_LIBRARY_CABINETRY_BASE_HANDLE_OPTIONS = ["Sharkfin", "Channel pull", "Pull handle from Handle House builder range"];
export const PRODUCT_LIBRARY_CABINETRY_OVERHEAD_HANDLE_OPTIONS = ["Pull handle from Handle House builder range", "Handleless"];
export const PRODUCT_LIBRARY_CABINETRY_FEATURE_OPTIONS = ["Integrated dishwasher panel", "Integrated fridge panel", "Wine rack", "Cleated shelving", "Floating shelves"];

export const PRODUCT_LIBRARY_CABINETRY_SCHEDULE_TYPE_OPTIONS = [
  "Standard base unit",
  "Corner unit",
  "Sink cupboard",
  "Pull-out bin",
  "Underbench oven cabinet",
  "Dishwasher cabinet",
  "Microwave cabinet",
  "Rangehood cabinet",
  "Tall pantry",
  "Four-bank drawers",
  "Five-bank drawers",
  "Two-bank pot drawers",
  "Three-bank pot drawers: one small and two large",
  "Hidden drawers",
];

// Laundry has its own cabinet schedule rather than the Kitchen list above, which carries
// oven, dishwasher, microwave, rangehood, pot-drawer, corner and bin units a laundry does not
// use. Each unitType is the productName (or alias) of an existing structural product below, so
// quoting and the cabinetmaker RFQ resolve it exactly as they do for Kitchen lines. Washer and
// dryer entries are cabinetry openings only - the appliances themselves are selected elsewhere.
export const PRODUCT_LIBRARY_LAUNDRY_CABINETRY_SCHEDULE_GROUPS = [
  { title: "Standard laundry cabinetry", standard: true, items: ["Laundry tub base unit", "Overhead cabinets"] },
  { title: "Additional laundry cabinetry", standard: false, items: ["Standard base unit", "Four-bank drawers", "Underbench washing-machine provision", "Underbench dryer provision"] },
];

export const PRODUCT_LIBRARY_LAUNDRY_CABINETRY_SCHEDULE_TYPE_OPTIONS = PRODUCT_LIBRARY_LAUNDRY_CABINETRY_SCHEDULE_GROUPS.flatMap((group) => group.items);

export const PRODUCT_LIBRARY_WET_AREA_CABINETRY_SCHEDULE_TYPES = [
  "bath-floor-two-door",
  "bath-floor-one-door",
  "bath-floor-four-drawers",
  "bath-floor-towel-rack",
  "bath-wall-two-door",
  "bath-wall-one-door",
  "bath-wall-three-drawer",
  "bath-wall-two-drawer",
  "bath-wall-towel-display",
  "bath-tall-linen",
  "bath-shaving-two-door",
  "bath-shaving-one-door",
  "bath-linen-bulkhead",
  "bath-other-custom",
];

export const PRODUCT_LIBRARY_WET_AREA_CABINETRY_CONFIG = {
  scopeOptions: [
    ["floorMountedVanity", "Floor-mounted vanity", "Cabinet sits on the floor or a recessed base."],
    ["wallMountedVanity", "Wall-mounted vanity", "Suspended vanity cabinet with its own top options."],
    ["tallLinenCupboard", "Tall linen cupboard", "Tall bathroom storage cupboard."],
    ["mirroredShavingCabinet", "Mirrored shaving cabinet", "Mirror faces are not board-colour areas."],
    ["linenBulkhead", "Bulkhead over tall cupboard", "Available when a tall linen cupboard is selected."],
    ["otherBathroomCabinetry", "Other/custom bathroom cabinetry", "Record a non-standard bathroom cabinet."],
  ],
  scheduleGroups: [
    { title: "Floor-mounted vanity", scopeKeys: ["floorMountedVanity"], items: [["bath-floor-two-door", "Base unit with 2 doors"], ["bath-floor-one-door", "Base unit with 1 door"], ["bath-floor-four-drawers", "Set of 4 drawers"], ["bath-floor-towel-rack", "Towel display rack"]] },
    { title: "Wall-mounted vanity", scopeKeys: ["wallMountedVanity"], items: [["bath-wall-two-door", "2-door unit"], ["bath-wall-one-door", "1-door unit"], ["bath-wall-three-drawer", "3-drawer unit"], ["bath-wall-two-drawer", "2-drawer unit"], ["bath-wall-towel-display", "Towel display"]] },
    { title: "Additional bathroom cabinetry", scopeKeys: ["tallLinenCupboard", "mirroredShavingCabinet", "linenBulkhead"], items: [["bath-tall-linen", "Tall linen cupboard", "tallLinenCupboard"], ["bath-shaving-two-door", "2-door mirrored shaving cabinet", "mirroredShavingCabinet"], ["bath-shaving-one-door", "1-door mirrored shaving cabinet", "mirroredShavingCabinet"], ["bath-linen-bulkhead", "Bulkhead over tall cupboard", "linenBulkhead"]] },
    { title: "Other", scopeKeys: ["otherBathroomCabinetry"], items: [["bath-other-custom", "Other/custom bathroom cabinet", "otherBathroomCabinetry"]] },
  ],
  areaRules: [
    { key: "floorVanityDoors", schedules: ["bath-floor-two-door", "bath-floor-one-door"] },
    { key: "floorVanityDrawers", schedules: ["bath-floor-four-drawers"] },
    { key: "floorVanityTowelDisplay", schedules: ["bath-floor-towel-rack"] },
    { key: "wallVanityDoors", schedules: ["bath-wall-two-door", "bath-wall-one-door"] },
    { key: "wallVanityDrawers", schedules: ["bath-wall-three-drawer", "bath-wall-two-drawer"] },
    { key: "wallVanityTowelDisplay", schedules: ["bath-wall-towel-display"] },
    { key: "tallLinenDoors", schedules: ["bath-tall-linen"] },
    { key: "tallLinenEndPanels", schedules: ["bath-tall-linen"] },
    { key: "linenBulkhead", schedules: ["bath-linen-bulkhead"], scopeKeys: ["linenBulkhead"] },
    { key: "bathroomOtherCustom", schedules: ["bath-other-custom"] },
  ],
  handleTargets: [
    ["floorMountedVanity", "Floor-mounted vanity"],
    ["wallMountedVanity", "Wall-mounted vanity"],
    ["tallLinenCupboard", "Tall linen cupboard"],
    ["mirroredShavingCabinet", "Mirrored shaving cabinet"],
  ],
  handleOptions: ["Handleless", "Finger Pull - Shark Fin", "Push-to-open", "Pull handle from Handle House builder range", "Other/custom"],
  benchtopOptions: {
    floorMountedVanity: ["Laminated benchtop", "Stone benchtop", "Other/custom"],
    wallMountedVanity: ["Laminated with mitred drop front", "Stone with mitred drop front", "Standard laminated", "Standard stone", "Other/custom"],
  },
  featureOptions: ["Soft-close doors and drawers", "Moisture-resistant cabinet carcass", "Wall-to-wall filler panels", "Internal power provision", "Custom open shelf"],
};

export const PRODUCT_LIBRARY_HANDLE_HOUSE_CATALOGUE = [
  handleHouseProduct("HH-C3", "C3 Post and Rail", "C3", "T-bar pull", ["96mm", "128mm", "160mm", "224mm", "320mm"], ["Matt Black", "Polished Stainless Steel", "Brushed Stainless Steel"], "/images/catalogues/product-library/categories/cabinet-handles-handle-house-c3.jpg", "https://handlehouse.com.au/products/c3-post-and-rail-cabinet-handles"),
  handleHouseProduct("HH-C108", "C108 Richmond", "C108", "Pull handle", ["288mm"], ["Satin Nickel"], "https://handlehouse.com.au/cdn/shop/files/C108_SN_copy_1_1200x1200.jpg?v=1771981882", "https://handlehouse.com.au/products/c108-richmond-cabinet-handles"),
  // Images verified 2026-09-20: these three previously shared one unrelated placeholder photo
  // (DSC07525_2...) despite being three distinct handle designs - corrected to each product's own
  // genuine Handle House product image, found via its official product page.
  handleHouseProduct("HH-C139", "C139 Aspley", "C139", "Pull handle", ["128mm"], ["Matt Black"], "https://handlehouse.com.au/cdn/shop/files/C139_MB_copy.jpg?v=1771983022", "https://handlehouse.com.au/products/c139-aspley-cabinet-handles"),
  handleHouseProduct("HH-C156", "C156 Bondi", "C156", "Pull handle", ["160mm"], ["Matt Black", "Brushed Brass"], "https://handlehouse.com.au/cdn/shop/files/C156_Family_copy.png?v=1747213065", "https://handlehouse.com.au/products/c156-bondi-cabinet-handles"),
  handleHouseProduct("HH-C178", "C178 Casey lip pull", "C178", "Lip pull", ["160mm", "224mm", "320mm"], ["Matt Black", "Brushed Nickel"], "https://handlehouse.com.au/cdn/shop/files/C178_FAMILY.jpg?v=1734053514", "https://handlehouse.com.au/products/c178-casey-cabinet-handles"),
  handleHouseProduct("HH-C214", "C214 Northcote", "C214", "Pull handle", ["160mm", "320mm"], ["Brushed Brass", "Black"], "https://handlehouse.com.au/cdn/shop/files/C214_Family_copy_1200x1200.png?v=1747215886", "https://handlehouse.com.au/products/c214-northcote-cabinet-handles"),
  handleHouseProduct("HH-C230", "C230 Kimberley", "C230", "Pull handle", ["160mm"], ["Black"], "https://handlehouse.com.au/cdn/shop/files/C230_BL_1200x1200.jpg?v=1741165548", "https://handlehouse.com.au/products/c230-kimberley-cabinet-handle"),
  handleHouseProduct("HH-C234", "C234/C235 Hillgrove", "C234/C235", "Knob and pull family", ["Knob", "160mm pull"], ["Matt Black", "Brushed Brass"], "https://handlehouse.com.au/cdn/shop/files/C234_FAMILY_1200x1200.jpg?v=1732848685", "https://handlehouse.com.au/products/c234-hillgrove-cabinet-handle"),
];

export const PRODUCT_LIBRARY_CABINETRY_STRUCTURAL_PRODUCTS = [
  ...PRODUCT_LIBRARY_CABINETRY_SCHEDULE_TYPE_OPTIONS.map((name) => cabinetryStructuralProduct({
    id: stableCabinetryScheduleId(name),
    productName: name,
    category: "Cabinet units and schedules",
    model: "Cabinet unit / assembly",
    description: `${name} for a room-specific cabinetmaker schedule; finish, hardware and benchtop selections are linked separately.`,
    recordType: "cabinet_unit",
    quotationMappingId: `quote-cabinetry-unit-${slugId(name)}`,
    aliases: [name],
    applicableRooms: ["kitchen", "butlers-pantry", "laundry", "living-areas", "bedrooms", "internal-areas"],
  })),
  cabinetryStructuralProduct({
    id: "CABINETRY-UNIT-OVERHEAD",
    productName: "Overhead cabinet unit schedule item",
    category: "Cabinet units and schedules",
    model: "Overhead cabinet unit",
    description: "Builder-defined overhead cabinet quantity; finish selected separately.",
    recordType: "cabinet_unit",
    quotationMappingId: "quote-cabinetry-unit-overhead",
    aliases: ["Overhead cabinet", "Overhead cabinets", "Overheads", "overheadDoors"],
    applicableRooms: ["kitchen", "butlers-pantry", "laundry", "living-areas", "bedrooms", "internal-areas"],
  }),
  ...PRODUCT_LIBRARY_WET_AREA_CABINETRY_CONFIG.scheduleGroups.flatMap((group) => group.items.map(([id, name]) => cabinetryStructuralProduct({
    id: `CABINETRY-UNIT-${String(id).toUpperCase()}`,
    productName: name,
    category: "Wet-area cabinet units and schedules",
    model: "Vanity / linen / shaving cabinet assembly",
    description: `${name} for bathroom, ensuite or powder-room cabinetry schedules; finish, handle and benchtop selections are linked separately.`,
    recordType: "cabinet_unit",
    quotationMappingId: `quote-cabinetry-unit-${id}`,
    aliases: [id, name],
    applicableRooms: ["bathroom", "ensuite", "powder-room"],
  }))),
  cabinetryStructuralProduct({ id: "CABINETRY-KICK-PANEL-BRUSHED-ALUMINIUM", productName: "Brushed aluminium kick panels", category: "Kick panels", model: "Metal kick panel", description: "Supply and install brushed aluminium kick panels.", recordType: "shelving_feature", quotationMappingId: "quote-cabinetry-kick-panel-brushed-aluminium", aliases: ["brushed_aluminium", "Brushed aluminium"] }),
  cabinetryStructuralProduct({ id: "CABINETRY-KICK-PANEL-STAINLESS-STEEL-LOOK", productName: "Stainless-steel look kick panels", category: "Kick panels", model: "Metal kick panel", description: "Supply and install stainless-steel look kick panels.", recordType: "shelving_feature", quotationMappingId: "quote-cabinetry-kick-panel-stainless-look", aliases: ["stainless_steel_look", "Stainless-steel look"] }),
  cabinetryStructuralProduct({ id: "CABINETRY-KICK-PANEL-BLACK-ALUMINIUM", productName: "Black aluminium kick panels", category: "Kick panels", model: "Metal kick panel", description: "Supply and install black aluminium kick panels.", recordType: "shelving_feature", quotationMappingId: "quote-cabinetry-kick-panel-black-aluminium", aliases: ["black_aluminium", "Black aluminium"] }),
  cabinetryStructuralProduct({ id: "CABINETRY-BULKHEAD-RAW-MDF", productName: "Raw MDF bulkheads", category: "Bulkheads", model: "Raw MDF bulkhead", description: "Raw MDF bulkheads prepared for wall or ceiling paint.", recordType: "shelving_feature", quotationMappingId: "quote-cabinetry-bulkhead-raw-mdf", aliases: ["raw_mdf_wall_paint", "raw_mdf_ceiling_paint", "raw_mdf_custom_paint"] }),
  cabinetryStructuralProduct({ id: "CABINETRY-SHELVING-OPEN", productName: "Open cabinetry shelving", category: "Shelving", model: "Open shelf", description: "Open shelves in selected cabinetry finish or nominated board.", recordType: "shelving_feature", quotationMappingId: "quote-cabinetry-shelving-open", aliases: ["Open cabinetry shelves", "Open shelving", "Custom open shelf"] }),
  cabinetryStructuralProduct({ id: "CABINETRY-SHELVING-CLEATED", productName: "Cleated shelving under 1200 mm", category: "Shelving", model: "Cleated shelf", description: "Cleated shelving for robes, linen and internal joinery.", recordType: "shelving_feature", quotationMappingId: "quote-cabinetry-shelving-cleated", aliases: ["Cleated shelving", "Cleated shelving under 1200 mm"] }),
  cabinetryStructuralProduct({ id: "CABINETRY-SHELVING-FLOATING", productName: "Floating shelves", category: "Shelving", model: "Floating shelf", description: "Floating shelves in selected cabinetry finish or nominated board.", recordType: "shelving_feature", quotationMappingId: "quote-cabinetry-shelving-floating", aliases: ["Floating shelves"] }),
  cabinetryStructuralProduct({ id: "CABINETRY-HARDWARE-BLUM-SOFT-CLOSE", productName: "Blum soft-close hinges and drawer runners", category: "Hardware", model: "Soft-close hardware", description: "Blum soft-close door hinges and drawer runners allowance/reference item.", recordType: "hardware_product", quotationMappingId: "quote-cabinetry-hardware-blum-soft-close", aliases: ["Soft-close doors and drawers", "Blum soft-close", "Soft-close hardware"] }),
  cabinetryStructuralProduct({ id: "CABINETRY-HARDWARE-STANDARD-RUNNERS", productName: "Standard cabinet hinges and runners", category: "Hardware", model: "Standard hardware", description: "Standard cabinet hinges and runners for builder catalogue allowances.", recordType: "hardware_product", quotationMappingId: "quote-cabinetry-hardware-standard-runners", aliases: ["Standard runners", "Concealed hinges"] }),
  cabinetryStructuralProduct({ id: "CABINETRY-APPLIANCE-PANEL-DISHWASHER", productName: "Integrated dishwasher panel", category: "Appliance panels", model: "Integrated appliance panel", description: "Cabinetry panel provision for integrated dishwasher installation.", recordType: "shelving_feature", quotationMappingId: "quote-cabinetry-appliance-panel-dishwasher", aliases: ["Integrated dishwasher panel"] }),
  cabinetryStructuralProduct({ id: "CABINETRY-APPLIANCE-PANEL-FRIDGE", productName: "Integrated fridge panel", category: "Appliance panels", model: "Integrated appliance panel", description: "Cabinetry panel provision for integrated fridge installation.", recordType: "shelving_feature", quotationMappingId: "quote-cabinetry-appliance-panel-fridge", aliases: ["Integrated fridge panel"] }),
  cabinetryStructuralProduct({ id: "CABINETRY-FEATURE-WINE-RACK", productName: "Wine rack", category: "Accessories and features", model: "Wine rack", description: "Cabinetmaker wine rack feature for selected room cabinetry.", recordType: "shelving_feature", quotationMappingId: "quote-cabinetry-feature-wine-rack", aliases: ["Wine rack"] }),
  cabinetryStructuralProduct({ id: "CABINETRY-LAUNDRY-TUB-BASE-UNIT", productName: "Laundry tub base unit", category: "Laundry cabinetry", model: "Laundry tub base cabinet", description: "Base cabinet housing the laundry tub; tub, tapware and benchtop are selected separately.", recordType: "cabinet_unit", quotationMappingId: "quote-cabinetry-laundry-tub-base-unit", aliases: ["Laundry tub base unit", "Laundry tub cabinet"], applicableRooms: ["laundry"] }),
  cabinetryStructuralProduct({ id: "CABINETRY-LAUNDRY-WASHING-MACHINE-PROVISION", productName: "Underbench washing-machine provision", category: "Laundry cabinetry", model: "Underbench appliance provision", description: "Underbench washing-machine space within laundry cabinetry.", recordType: "cabinet_unit", quotationMappingId: "quote-cabinetry-laundry-washer-provision", aliases: ["underbench washing-machine provision", "underbench washing-machine space"], applicableRooms: ["laundry"] }),
  cabinetryStructuralProduct({ id: "CABINETRY-LAUNDRY-DRYER-PROVISION", productName: "Underbench dryer provision", category: "Laundry cabinetry", model: "Underbench appliance provision", description: "Underbench dryer space within laundry cabinetry.", recordType: "cabinet_unit", quotationMappingId: "quote-cabinetry-laundry-dryer-provision", aliases: ["underbench dryer provision", "underbench dryer space"], applicableRooms: ["laundry"] }),
  cabinetryStructuralProduct({ id: "CABINETRY-ROBE-HANGING-RAIL", productName: "Wardrobe hanging rail", category: "Robes and internal joinery", model: "Hanging rail", description: "Hanging rail for robe, linen or internal joinery fitout.", recordType: "shelving_feature", quotationMappingId: "quote-cabinetry-robe-hanging-rail", aliases: ["hanging rail", "wardrobe rail"], applicableRooms: ["bedrooms", "internal-areas"] }),
];

export const LAMINEX_CABINETRY_CATALOGUE = laminexCabinetryColours.map(normaliseLaminexCabinetryColour);
export const POLYTEC_CABINETRY_CATALOGUE = polytecCabinetryColours.map(normalisePolytecCabinetryColour);

// Build these small, cabinetry-specific views once. Components keep only selected
// product snapshots in room state and never need the full master catalogue.
const EMPTY_CABINETRY_RECORDS = Object.freeze([]);
const CABINETRY_COLOUR_RECORDS = [...LAMINEX_CABINETRY_CATALOGUE, ...POLYTEC_CABINETRY_CATALOGUE];
const CABINETRY_HANDLE_RECORDS = PRODUCT_LIBRARY_HANDLE_HOUSE_CATALOGUE.map((record) => ({
  ...record,
  productId: cabinetryHandleToMasterProduct(record).productId,
  sku: record.productCode,
  brand: record.supplier,
  range: record.style,
  model: record.productCode,
  availabilityStatus: "active",
}));
const CABINETRY_KICKBOARD_RECORDS = PRODUCT_LIBRARY_CABINETRY_STRUCTURAL_PRODUCTS
  .filter((record) => record.id.startsWith("CABINETRY-KICK-PANEL-"))
  .map((record) => ({ ...record, ...cabinetryStructuralToMasterProduct(record), availabilityStatus: "active" }));
const CABINETRY_LAMINATE_RECORDS = [...polytecLaminateBenchtops.products, ...laminexLaminateBenchtops.products]
  .map((record) => ({ ...record, requiresVariantSelection: Boolean(record.variants?.length) }));
const CABINETRY_STONE_RECORDS = (stoneBenchtopCatalogue.products || [])
  .filter((record) => ["Caesarstone", "Neolith"].includes(record.brand || record.supplier))
  .map((record) => ({
    ...record,
    productId: record.productId || record.id,
    sku: record.sku || record.productCode || record.id,
    productName: record.productName || record.colourName,
    brand: record.brand || record.supplier,
    range: record.range || record.collection,
    imageUrl: record.primarySwatchImage || record.slabImage || "",
  }));
const CABINETRY_COLOUR_VIEWS = cabinetryRecordViews(CABINETRY_COLOUR_RECORDS);
const CABINETRY_HANDLE_VIEWS = cabinetryRecordViews(CABINETRY_HANDLE_RECORDS);
const CABINETRY_KICKBOARD_VIEWS = cabinetryRecordViews(CABINETRY_KICKBOARD_RECORDS);
const CABINETRY_BENCHTOP_VIEWS = new Map([
  ["laminate", cabinetryRecordViews(CABINETRY_LAMINATE_RECORDS)],
  ["stone", cabinetryRecordViews(CABINETRY_STONE_RECORDS)],
  ["", cabinetryRecordViews([...CABINETRY_LAMINATE_RECORDS, ...CABINETRY_STONE_RECORDS])],
]);

export function getProductLibraryCabinetryColourRecords({ brand = "", availableOnly = false } = {}) {
  return cabinetryRecordsFromView(CABINETRY_COLOUR_VIEWS, brand, availableOnly);
}

export function getProductLibraryCabinetryHandleRecords({ availableOnly = false } = {}) {
  return cabinetryRecordsFromView(CABINETRY_HANDLE_VIEWS, "", availableOnly);
}

export function getProductLibraryCabinetryKickboardRecords({ availableOnly = false } = {}) {
  return cabinetryRecordsFromView(CABINETRY_KICKBOARD_VIEWS, "", availableOnly);
}

export function getProductLibraryCabinetryBenchtopRecords({ material = "", brand = "", availableOnly = false } = {}) {
  return cabinetryRecordsFromView(CABINETRY_BENCHTOP_VIEWS.get(material), brand, availableOnly);
}

export function isProductLibraryCabinetryRecordAvailable(record = {}) {
  return record.active !== false && !record.discontinued
    && !["inactive", "discontinued", "unavailable"].includes(record.availabilityStatus)
    && !["inactive", "discontinued"].includes(record.status);
}

function cabinetryRecordViews(records) {
  const views = new Map();
  for (const brand of new Set(["", ...records.map((record) => record.brand || record.supplier)])) {
    const all = Object.freeze(brand ? records.filter((record) => record.brand === brand || record.supplier === brand) : records);
    views.set(brand, { all, available: Object.freeze(all.filter(isProductLibraryCabinetryRecordAvailable)) });
  }
  return views;
}

function cabinetryRecordsFromView(views, brand, availableOnly) {
  const view = views?.get(brand);
  return (availableOnly ? view?.available : view?.all) || EMPTY_CABINETRY_RECORDS;
}

export function cabinetryColourToMasterProduct(record = {}) {
  const asset = PRODUCT_LIBRARY_CABINETRY_BRAND_ASSETS[record.brand] || {};
  return {
    productCode: record.id,
    productId: `master-${record.id}`,
    familyKey: "cabinet-finish",
    requirementKeys: ["cabinet-finish", "cabinetry"],
    categoryKey: "Cabinet Doors & Panels",
    topLevelArea: "kitchen",
    manufacturer: record.brand,
    brand: record.brand,
    supplier: record.supplier,
    brandLogoUrl: asset.logo || "",
    range: record.productRange || record.productFamily || "Cabinetry doors and panels",
    collection: record.productFamily || record.productRange || "",
    productName: `${record.colourName} ${record.finish}`.trim(),
    model: record.colourCode || "",
    sku: record.colourCode || record.id || "",
    description: record.description || `${record.colourName} ${record.finish} for ${record.application || "cabinetry doors, drawers and panels"}.`,
    colour: record.colourName || "",
    officialColourName: record.colourName || "",
    colourGroup: record.colourFamily || "",
    finish: record.finish || "",
    configuration: record.productRange || "",
    material: record.substrate || "Decorative board",
    primaryImageUrl: record.swatchImage || "",
    thumbnailUrl: record.swatchThumbnail || record.swatchImage || "",
    imageSourceUrl: record.officialSwatchUrl || record.officialProductUrl || "",
    imageSourceType: record.swatchImage ? "verified_exact" : "official_unavailable",
    imageVerifiedAt: record.verifiedAt || "",
    imageStatus: record.swatchImage ? "verified_exact" : "missing",
    officialProductUrl: record.officialProductUrl || "",
    specificationUrl: record.officialCollectionUrl || "",
    supplierUrl: asset.officialUrl || record.officialCollectionUrl || "",
    priceStatus: record.priceStatus === "supplier_quote_required" ? "quote_required" : record.priceStatus || "price_pending",
    priceVerifiedAt: record.verifiedAt || "",
    priceUnit: "ITEM",
    active: record.availabilityStatus !== "inactive",
    discontinued: record.availabilityStatus === "inactive",
    sourceType: "official_supplier_catalogue",
    sourceName: record.source || `${record.brand} cabinetry colour catalogue`,
    sourceUrl: record.officialCollectionUrl || record.officialProductUrl || "",
    sourceVerifiedAt: record.verifiedAt || "",
    attributes: {
      applicableRooms: PRODUCT_LIBRARY_CABINETRY_ROOM_IDS,
      brandLogoUrl: asset.logo || "",
      legacyProductLibraryOwner: "product-library",
      legacySelectionAlias: record.id,
      colour: record.colourName || "",
      colourFamily: record.colourFamily || "",
      colourGroup: record.colourFamily || "",
      finish: record.finish || "",
      range: record.productRange || "",
      pricingTier: record.pricingTier || "",
      priceStatus: record.priceStatus || "",
      availabilityStatus: record.availabilityStatus || "active",
      officialSwatchUrl: record.officialSwatchUrl || "",
      application: record.application || "",
      substrate: record.substrate || "",
      doorPanelSuitability: record.doorPanelSuitability !== false,
      benchtopSuitability: Boolean(record.benchtopSuitability),
      sheetDoorApplicability: record.application || "Cabinetry doors, drawers and panels",
    },
  };
}

export function cabinetryHandleToMasterProduct(record = {}) {
  return {
    productCode: `HANDLE-HOUSE-${record.productCode}`,
    productId: `master-handle-house-${String(record.productCode || record.id).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    familyKey: "handles",
    requirementKeys: ["handles", "cabinet-handles", "cabinetry"],
    categoryKey: "Cabinet Handles",
    topLevelArea: "kitchen",
    manufacturer: "Handle House",
    brand: "Handle House",
    supplier: "Handle House",
    range: record.style || "Cabinet handles",
    productName: record.productName,
    model: record.productCode,
    sku: record.productCode,
    description: `${record.productName} ${record.style}; sizes ${record.sizes.join(", ")}; finishes ${record.finishes.join(", ")}.`,
    finish: record.finishes.join(", "),
    size: record.sizes.join(", "),
    configuration: record.style,
    material: record.material,
    primaryImageUrl: record.imageUrl,
    thumbnailUrl: record.imageUrl,
    imageSourceUrl: record.productUrl,
    imageSourceType: "verified_exact",
    imageVerifiedAt: record.lastVerifiedDate || "",
    imageStatus: "verified_exact",
    officialProductUrl: record.productUrl,
    supplierUrl: "https://handlehouse.com.au/collections/cabinet-handles",
    priceStatus: record.priceStatus || "price_pending",
    priceUnit: "EACH",
    active: true,
    sourceType: "official_supplier_catalogue",
    sourceName: "Handle House cabinet handles",
    sourceUrl: record.productUrl,
    sourceVerifiedAt: record.lastVerifiedDate || "",
    attributes: {
      applicableRooms: PRODUCT_LIBRARY_CABINETRY_ROOM_IDS,
      legacySelectionAlias: record.id,
      sizes: record.sizes,
      finishes: record.finishes,
      selectedSize: record.selectedSize,
      selectedFinish: record.selectedFinish,
      style: record.style,
    },
  };
}

export function cabinetryStructuralToMasterProduct(record = {}) {
  // Catalogue rates are shown at the standard-colourboard baseline; the estimate applies
  // the finish multiplier once a door finish is chosen for the room.
  const estimate = getCabinetryUnitRate(record.id, DEFAULT_CABINETRY_FINISH);
  return {
    productCode: record.id,
    productId: `master-${record.id}`,
    familyKey: "cabinetry",
    requirementKeys: ["cabinetry"],
    categoryKey: record.category,
    category: record.category,
    masterGroup: "Cabinetry",
    topLevelArea: "kitchen",
    manufacturer: record.supplier,
    brand: record.brand,
    supplier: record.supplier,
    range: record.range,
    productName: record.productName,
    model: record.model,
    sku: record.id,
    description: record.description,
    configuration: record.model,
    primaryImageUrl: record.imageUrl,
    thumbnailUrl: record.imageUrl,
    imageSourceUrl: record.imageSourceUrl,
    imageSourceType: "category_card",
    imageVerifiedAt: record.verifiedAt,
    imageStatus: "verified_range",
    officialProductUrl: record.officialProductUrl || "",
    supplierUrl: record.supplierUrl || "",
    rrp: estimate.rate,
    clientPrice: null,
    currency: "AUD",
    gstIncluded: true,
    normalizedUnitPrice: estimate.rate,
    // price_pending, never "current": these are industry estimates, not supplier quotes.
    priceStatus: estimate.priceStatus || record.priceStatus,
    priceUnit: estimate.unit || record.unit,
    priceBasis: estimate.rate === null ? estimate.reason : `Estimated supply and install, ${DEFAULT_CABINETRY_FINISH}. ${estimate.reason}`,
    active: true,
    sourceType: "canonical_cabinetry_workflow",
    sourceName: record.sourceName || "Builder Catalogue Item",
    sourceUrl: record.sourceUrl || "",
    sourceVerifiedAt: record.verifiedAt,
    attributes: {
      applicableRooms: record.applicableRooms || PRODUCT_LIBRARY_CABINETRY_ROOM_IDS,
      categoryType: record.categoryType,
      canonicalType: record.recordType || record.categoryType,
      compatibleUnitIds: record.compatibleUnitIds || [],
      compatibleHardwareIds: record.compatibleHardwareIds || [],
      legacySelectionAliases: record.aliases || [],
      quotationMappingId: record.quotationMappingId || "",
      quotationSectionId: "cabinetry-joinery",
      quotationSection: "Cabinetry",
      quotationSubsection: record.category,
      catalogueOwner: "product-library",
      displaySourceLabel: "Builder Catalogue Item",
      snapshotPreserved: true,
    },
  };
}

export function getProductLibraryCabinetryMasterProducts() {
  return [
    ...getProductLibraryCabinetryColourRecords().map(cabinetryColourToMasterProduct),
    ...getProductLibraryCabinetryHandleRecords().map(cabinetryHandleToMasterProduct),
    ...PRODUCT_LIBRARY_CABINETRY_STRUCTURAL_PRODUCTS.map(cabinetryStructuralToMasterProduct),
    ...CABINETRY_LAMINATE_RECORDS.map(cabinetryLaminateToMasterProduct),
  ];
}

export function cabinetryLaminateToMasterProduct(record) {
  return {
    ...record,
    // Product Library productCode is its canonical key. Manufacturer SKUs belong
    // to sheet variants; a colour family has no invented manufacturer SKU.
    productCode: record.id,
    productId: record.productId,
    familyKey: "laminate-benchtops",
    requirementKeys: ["benchtop", "laminate-benchtops"],
    categoryKey: "Benchtops",
    topLevelArea: "kitchen",
    manufacturer: record.brand,
    primaryImageUrl: record.imageUrl || "",
    colour: record.colourName,
    officialColourName: record.colourName,
    thumbnailUrl: record.imageUrl || "",
    imageSourceUrl: record.officialProductUrl,
    imageSourceType: record.imageUrl ? "verified_exact" : "official_unavailable",
    imageStatus: record.imageUrl ? "verified_exact" : "missing",
    imageVerifiedAt: record.verifiedAt,
    priceStatus: "quote_required",
    priceUnit: "SHEET",
    sourceType: "official_supplier_catalogue",
    sourceName: `${record.brand} laminate benchtop catalogue`,
    sourceVerifiedAt: record.verifiedAt,
    attributes: {
      canonicalType: "benchtop_product",
      catalogueOwner: "product-library",
      applicableRooms: record.applicableRooms || PRODUCT_LIBRARY_CABINETRY_ROOM_IDS,
      materialType: record.materialType || "Laminate",
      benchtopSuitability: true,
      finishOptions: record.finishes,
      variants: record.variants,
      thicknessKind: "laminate_sheet",
      laminateSheetThicknessOptions: record.laminateSheetThicknessOptions || record.thicknessOptions || [],
      requiresVariantSelection: true,
      availabilityStatus: record.availabilityStatus,
      quotationSectionId: "cabinetry-joinery",
    },
  };
}

function handleHouseProduct(id, productName, productCode, style, sizes, finishes, imageUrl, productUrl) {
  return {
    id,
    supplier: "Handle House",
    productName,
    productCode,
    style,
    sizes,
    finishes,
    selectedSize: sizes[0],
    selectedFinish: finishes[0],
    overallLength: sizes[0],
    holeCentres: sizes[0],
    projection: "Supplier published page",
    material: "Supplier specified",
    compatibleDoorThickness: "Standard 16-18mm cabinet doors; thicker fronts require confirmation",
    includedStatus: "builder_configurable",
    priceStatus: "price_pending",
    imageUrl,
    lifestyleImage: "",
    productUrl,
    lastVerifiedDate: "2026-08-30",
  };
}

function cabinetryStructuralProduct({
  id,
  productName,
  category,
  model,
  description,
  recordType = "cabinet_unit",
  quotationMappingId = "",
  aliases = [],
  applicableRooms = PRODUCT_LIBRARY_CABINETRY_ROOM_IDS,
  compatibleUnitIds = [],
  compatibleHardwareIds = [],
  imageUrl = PRODUCT_LIBRARY_CABINETRY_CATEGORY_ASSETS["cabinet-doors-panels"].image,
  imageSourceUrl = PRODUCT_LIBRARY_CABINETRY_CATEGORY_ASSETS["cabinet-doors-panels"].sourceUrl,
} = {}) {
  return {
    id,
    supplier: "Builder Cabinetry",
    brand: "Builder Cabinetry",
    range: category,
    category: recordType === "hardware_product" ? "Cabinet Hardware"
      : ["Kick panels", "Appliance panels"].includes(category) ? "Cabinet Doors & Panels"
      : "Cabinetry Products",
    categoryType: recordType,
    recordType,
    productName,
    model,
    description,
    unit: "ITEM",
    priceStatus: "quote_required",
    sourceName: "Builder Catalogue Item",
    sourceUrl: "product-library://cabinetry/builder-catalogue-items",
    officialProductUrl: "",
    supplierUrl: "",
    quotationMappingId,
    aliases,
    applicableRooms,
    compatibleUnitIds,
    compatibleHardwareIds,
    imageUrl,
    imageSourceUrl,
    verifiedAt: "2026-09-04",
  };
}

function slugId(value = "") {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stableCabinetryScheduleId(name = "") {
  if (name === "Standard base unit") return "CABINETRY-UNIT-STANDARD-BASE";
  return `CABINETRY-UNIT-${slugId(name)}`;
}

function normaliseLaminexCabinetryColour(record = {}) {
  const pricingTier = record.pricingTier || "tier_2";
  return {
    ...record,
    productId: record.productId || `master-${record.id}`,
    productCode: record.productCode || record.id,
    sku: record.sku || record.colourCode || record.id,
    productName: record.productName || `${record.colourName || ""} ${record.finish || ""}`.trim(),
    range: record.range || record.productRange || record.productFamily,
    imageUrl: record.imageUrl || record.swatchThumbnail || record.swatchImage || "",
    supplier: "Laminex",
    brand: record.brand || "Laminex",
    productFamily: record.productFamily || record.productRange || "Laminex Decorated Panels & Boards",
    productRange: record.productRange || record.productFamily || "Laminex Decorated Panels & Boards",
    colourCode: record.colourCode || record.id || "",
    colourFamily: record.colourFamily || "Whites & Neutrals",
    application: record.application || "Cabinetry doors, drawers and panels",
    pricingTier,
    priceStatus: record.priceStatus || (pricingTier === "tier_1" ? "included" : pricingTier === "tier_2" ? "upgrade" : "supplier_quote_required"),
    sourceUrl: record.officialProductUrl || record.sourceUrl || record.officialCollectionUrl || "",
    officialProductUrl: record.officialProductUrl || record.sourceUrl || "",
    officialCollectionUrl: record.officialCollectionUrl || "https://www.laminex.com.au/browse/product-application/cabinetry-doors-drawers",
    availabilityStatus: record.availabilityStatus || "active",
    status: record.availabilityStatus === "inactive" ? "inactive" : record.status || "active",
    verifiedAt: record.verifiedAt || record.lastVerifiedDate || "2026-08-31",
    lastVerifiedDate: record.lastVerifiedDate || record.verifiedAt || "2026-08-31",
    doorPanelSuitability: true,
    // A cabinetry panel (including AbsoluteMatte) is not evidence of a
    // benchtop laminate product. Only supplier-recorded suitability qualifies.
    benchtopSuitability: record.benchtopSuitability === true,
    matchingEdgingAvailability: true,
  };
}

function normalisePolytecCabinetryColour(record = {}) {
  const pricingTier = record.pricingTier || "tier_2";
  return {
    ...record,
    productId: record.productId || `master-${record.id}`,
    productCode: record.productCode || record.id,
    sku: record.sku || record.colourCode || record.id,
    productName: record.productName || `${record.colourName || ""} ${record.finish || ""}`.trim(),
    range: record.range || record.productRange || record.productFamily,
    imageUrl: record.imageUrl || record.swatchThumbnail || record.swatchImage || "",
    supplier: "Polytec",
    brand: record.brand || "Polytec",
    productFamily: record.productFamily || record.productRange || "Polytec cabinetry doors and panels",
    productRange: record.productRange || record.productFamily || "Polytec cabinetry doors and panels",
    colourCode: record.colourCode || record.id || "",
    colourFamily: record.colourFamily || "Whites & Neutrals",
    application: record.application || record.productApplication || "Cabinetry doors and panels",
    pricingTier,
    priceStatus: record.priceStatus || (pricingTier === "tier_1" ? "included" : pricingTier === "tier_2" ? "upgrade" : "supplier_quote_required"),
    sourceUrl: record.officialProductUrl || record.sourceUrl || record.officialCollectionUrl || "",
    officialProductUrl: record.officialProductUrl || record.sourceUrl || "",
    officialCollectionUrl: record.officialCollectionUrl || "https://www.polytec.com.au/colours/",
    availabilityStatus: record.availabilityStatus || "active",
    status: record.availabilityStatus === "inactive" ? "inactive" : record.status || "active",
    verifiedAt: record.verifiedAt || record.lastVerifiedDate || "2026-08-31",
    lastVerifiedDate: record.lastVerifiedDate || record.verifiedAt || "2026-08-31",
    doorPanelSuitability: record.doorPanelSuitability !== false,
    benchtopSuitability: Boolean(record.benchtopSuitability),
    matchingEdgingAvailability: record.matchingEdgingAvailability !== false,
  };
}
