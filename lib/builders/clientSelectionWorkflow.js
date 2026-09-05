import {
  familyByKey,
  isProductLibraryEligibleProduct,
  isRemovedDuplicateCladdingProduct,
  productMatchesFamily,
  resolveProductLibraryImage,
  selectionKeyForFamily,
} from "../product-library/catalogueModel.js";
import { numberValue, roundMoney } from "./selectionBudget.js";

export const KITCHEN_AREA_KEY = "kitchen";
export const KITCHEN_AREA_LABEL = "Kitchen";
export const APPLIANCE_AREA_KEY = "appliances";
export const APPLIANCE_AREA_LABEL = "Appliances";

export const KITCHEN_REQUIREMENTS = [
  requirement("cabinetry", "Cabinetry", "cabinetry", 2500, "ITEM"),
];

export const APPLIANCE_REQUIREMENTS = [
  requirement("oven", "Oven", "ovens", 1200, "EACH", 1, APPLIANCE_AREA_KEY, APPLIANCE_AREA_LABEL, "ovens"),
  requirement("cooktop", "Cooktop", "cooktops", 950, "EACH", 1, APPLIANCE_AREA_KEY, APPLIANCE_AREA_LABEL, "cooktops"),
  requirement("rangehood", "Rangehood", "rangehoods", 650, "EACH", 1, APPLIANCE_AREA_KEY, APPLIANCE_AREA_LABEL, "rangehoods"),
  requirement("dishwasher", "Dishwasher", "dishwashers", 1000, "EACH", 1, APPLIANCE_AREA_KEY, APPLIANCE_AREA_LABEL, "dishwashers"),
  requirement("microwave", "Microwave", "microwaves", 450, "EACH", 1, APPLIANCE_AREA_KEY, APPLIANCE_AREA_LABEL, "microwaves"),
  requirement("fridge", "Fridge", "fridges", 1600, "EACH", 1, APPLIANCE_AREA_KEY, APPLIANCE_AREA_LABEL, "fridges"),
  requirement("freestanding-cooker", "Freestanding Cooker", "freestanding-cookers", 1800, "EACH", 1, APPLIANCE_AREA_KEY, APPLIANCE_AREA_LABEL, "freestanding-cookers"),
  requirement("appliance-pack", "Appliance Packs", "appliance-packs", 0, "PACK", 1, APPLIANCE_AREA_KEY, APPLIANCE_AREA_LABEL, "appliance-packs"),
];

export const PLUMBING_FIXTURE_AREA_KEY = "plumbing-fixtures";
export const PLUMBING_FIXTURE_AREA_LABEL = "Plumbing Fixtures";

export const PLUMBING_FIXTURE_REQUIREMENTS = [
  requirement("sink", "Sink", "kitchen-sinks", 650, "EACH", 1, PLUMBING_FIXTURE_AREA_KEY, PLUMBING_FIXTURE_AREA_LABEL, "sinks"),
  requirement("sink-mixer", "Sink Mixer", "kitchen-sink-mixers", 420, "EACH", 1, PLUMBING_FIXTURE_AREA_KEY, PLUMBING_FIXTURE_AREA_LABEL, "tapware"),
  requirement("bathroom-basin", "Bathroom Basin", "basins", 650, "EACH", 1, PLUMBING_FIXTURE_AREA_KEY, PLUMBING_FIXTURE_AREA_LABEL, "basins"),
  requirement("basin-mixer", "Basin Mixer", "basin-mixers", 420, "EACH", 1, PLUMBING_FIXTURE_AREA_KEY, PLUMBING_FIXTURE_AREA_LABEL, "tapware"),
  requirement("bath", "Bath", "baths", 1200, "EACH", 1, PLUMBING_FIXTURE_AREA_KEY, PLUMBING_FIXTURE_AREA_LABEL, "baths"),
  requirement("shower-fixtures", "Shower Fixtures", "shower-fixtures", 900, "ITEM", 1, PLUMBING_FIXTURE_AREA_KEY, PLUMBING_FIXTURE_AREA_LABEL, "showers"),
  requirement("toilet-suite", "Toilet Suite", "toilets", 700, "EACH", 1, PLUMBING_FIXTURE_AREA_KEY, PLUMBING_FIXTURE_AREA_LABEL, "toilets"),
  requirement("laundry-tub", "Laundry Tub", "laundry-tubs", 650, "EACH", 1, PLUMBING_FIXTURE_AREA_KEY, PLUMBING_FIXTURE_AREA_LABEL, "sinks"),
  requirement("laundry-mixer", "Laundry Mixer", "laundry-mixers", 380, "EACH", 1, PLUMBING_FIXTURE_AREA_KEY, PLUMBING_FIXTURE_AREA_LABEL, "tapware"),
];

export const EXTERIOR_REQUIREMENTS = [
  requirement("bricks", "Bricks", "bricks", 0, "ITEM", 1, "exterior", "Exterior"),
  requirement("cladding", "Cladding", "cladding", 0, "ITEM", 1, "exterior", "Exterior", "cladding"),
  requirement("roofing", "Roofing", "roofing", 0, "ITEM", 1, "exterior", "Exterior", "roofing"),
  requirement("windows", "Windows", "windows", 0, "ITEM", 1, "exterior", "Exterior", "windows"),
  requirement("entry-door", "Entry Doors", "entry-doors", 0, "EACH", 1, "exterior", "Exterior", "entryDoors"),
  requirement("garage-door", "Garage Doors", "garage-doors", 0, "EACH", 1, "exterior", "Exterior", "garageDoors"),
  requirement("balustrades", "Balustrades", "balustrades", 0, "ITEM", 1, "exterior", "Exterior", "balustrades", { optionalWhenProjectMissing: true, projectAliases: ["balustrade", "balustrades", "handrail", "handrails", "balcony rail"] }),
  requirement("external-lighting", "External Lighting", "external-lighting", 0, "ITEM", 1, "exterior", "Exterior", "externalLighting"),
  requirement("exterior-paint", "Exterior Colours", "exterior-paint", 0, "ITEM", 1, "exterior", "Exterior", "exteriorPaint"),
  requirement("driveway", "Driveway", "driveway", 0, "ITEM", 1, "exterior", "Exterior", "drivewayFinishes", { optionalWhenProjectMissing: true, projectAliases: ["driveway", "driveway finish", "concrete driveway", "exposed aggregate", "pavers"] }),
  requirement("decking", "Decking", "decking", 0, "ITEM", 1, "exterior", "Exterior", "decking", { optionalWhenProjectMissing: true, projectAliases: ["deck", "decking", "timber deck", "composite deck"] }),
  requirement("pool", "Pool", "pool", 0, "ITEM", 1, "exterior", "Exterior", "pool", { optionalWhenProjectMissing: true, projectAliases: ["pool", "pool finish", "pool tile", "coping", "waterline"] }),
  requirement("retaining-walls", "Retaining Walls", "retaining-walls", 0, "ITEM", 1, "exterior", "Exterior", "retainingWalls", { optionalWhenProjectMissing: true, projectAliases: ["retaining wall", "retaining walls", "sleeper wall", "block wall"] }),
  requirement("landscaping", "Landscaping", "landscaping", 0, "ITEM", 1, "exterior", "Exterior", "landscaping", { optionalWhenProjectMissing: true, projectAliases: ["landscaping", "turf", "mulch", "garden edging", "feature gravel"] }),
];

export const INTERIOR_REQUIREMENTS = [
  requirement("kitchen", "Kitchen", "visual-kitchen", 0, "ITEM", 1, "interior", "Interior", "kitchen"),
  requirement("bathroom", "Bathroom", "visual-bathroom", 0, "ITEM", 1, "interior", "Interior", "bathroom"),
  requirement("ensuite", "Ensuite", "visual-ensuite", 0, "ITEM", 1, "interior", "Interior", "bathroom"),
  requirement("laundry", "Laundry", "visual-laundry", 0, "ITEM", 1, "interior", "Interior", "laundry"),
  requirement("bedroom", "Bedroom", "flooring", 0, "ITEM", 1, "interior", "Interior", "bedrooms"),
  requirement("living", "Living", "flooring", 0, "ITEM", 1, "interior", "Interior", "living"),
  requirement("internal-doors", "Internal Doors", "internal-doors", 0, "EACH", 1, "interior", "Interior", "internalDoors"),
  requirement("door-hardware", "Internal Door Furniture", "door-hardware", 0, "EACH", 1, "interior", "Interior", "door-hardware"),
  requirement("skirting", "Skirting", "skirting", 0, "LENGTH", 1, "interior", "Interior", "skirting"),
  requirement("architraves", "Architraves", "skirting", 0, "LENGTH", 1, "interior", "Interior", "architraves"),
  requirement("interior-flooring", "Flooring", "flooring", 0, "M2", 1, "interior", "Interior", "flooring"),
  requirement("interior-paint", "Paint", "visual-interior-paint", 0, "ITEM", 1, "interior", "Interior", "paint"),
  requirement("interior-lighting", "Lighting", "visual-interior-lighting", 0, "ITEM", 1, "interior", "Interior", "lighting"),
];

export const ALL_GUIDED_REQUIREMENTS = [
  ...KITCHEN_REQUIREMENTS,
  ...APPLIANCE_REQUIREMENTS,
  ...PLUMBING_FIXTURE_REQUIREMENTS,
  ...EXTERIOR_REQUIREMENTS,
  ...INTERIOR_REQUIREMENTS,
];

export const PRICE_STATES = {
  current: "Current Price",
  allowanceOnly: "Allowance Only",
  quoteRequired: "Quote Required",
  pending: "Price Pending",
  expired: "Price Expired",
};

export const GARAGE_DOOR_WORKFLOW_STEPS = [
  { key: "supplier", label: "Supplier" },
  { key: "range", label: "Door Type / Range" },
  { key: "profile", label: "Profile / Design" },
  { key: "size", label: "Size / Configuration" },
  { key: "colour", label: "Colour / Finish" },
  { key: "automation", label: "Automation" },
  { key: "accessories", label: "Accessories" },
  { key: "review", label: "Review and Confirm" },
];

export const EXTERNAL_LIGHTING_CATEGORIES = [
  "Wall Lights",
  "Ceiling & Pendant",
  "Security & Sensor",
  "Floodlights",
  "Bollards & Posts",
  "Step & Deck",
  "Garden & Landscape",
  "Solar",
  "Low Voltage",
];

export const EXTERNAL_LIGHTING_LOCATIONS = [
  "Front entry",
  "Front porch",
  "Porch",
  "Garage exterior",
  "Front elevation",
  "Rear elevation",
  "Left elevation",
  "Right elevation",
  "Side access",
  "Alfresco",
  "Patio",
  "Balcony",
  "Deck",
  "Driveway",
  "Pathway",
  "Garden",
  "Pool area",
  "Other custom location",
];

export const EXTERIOR_COLOUR_AREA_GROUPS = [
  "Walls",
  "Cladding",
  "Roofline",
  "Openings and surrounds",
  "Timber and features",
  "Other items",
];

export const EXTERIOR_COLOUR_FAMILIES = [
  "Whites",
  "Off-whites",
  "Creams",
  "Beige and stone",
  "Greys",
  "Charcoal",
  "Blacks",
  "Browns",
  "Timber tones",
  "Greens",
  "Blue-greens",
  "Blues",
  "Reds",
  "Terracotta",
  "Yellow",
  "Other",
];

export const EXTERIOR_COLOUR_AREAS = [
  exteriorColourArea("roof", "Roof", "Roofline", "COLORBOND roofing", "factory_finished", "Roofing selections", false, "roofing-selection"),
  exteriorColourArea("main-rendered-walls", "Main rendered walls", "Walls", "Render", "painted", "Job Details / exterior facade", true),
  exteriorColourArea("secondary-rendered-walls", "Secondary/accent rendered walls", "Walls", "Render", "painted", "Builder-added area", true),
  exteriorColourArea("painted-wall-cladding", "Painted wall cladding", "Cladding", "Fibre cement cladding", "painted", "Exterior material selections", true),
  exteriorColourArea("feature-wall-cladding", "Feature wall cladding", "Cladding", "Feature cladding", "factory_finished", "Exterior material selections", false),
  exteriorColourArea("eaves-soffits", "Eaves/soffits", "Roofline", "Fibre cement", "painted", "Roofing selections", true),
  exteriorColourArea("fascia", "Fascia", "Roofline", "Painted metal/timber", "painted", "Roofing selections", true),
  exteriorColourArea("gutters", "Gutters", "Roofline", "COLORBOND steel", "factory_finished", "Roofing selections", true),
  exteriorColourArea("downpipes", "Downpipes", "Roofline", "COLORBOND steel", "factory_finished", "Roofing selections", true),
  exteriorColourArea("window-surrounds", "Window surrounds", "Openings and surrounds", "Painted trim", "painted", "Window schedule", true),
  exteriorColourArea("door-surrounds", "Door surrounds", "Openings and surrounds", "Painted trim", "painted", "Door schedule", true),
  exteriorColourArea("entry-door-painted", "Entry door where painted", "Openings and surrounds", "Painted timber door", "painted", "Entry door selection", false),
  exteriorColourArea("garage-door-surround", "Garage door surround", "Openings and surrounds", "Painted trim", "painted", "Garage door selection", true),
  exteriorColourArea("timber-posts", "Timber posts", "Timber and features", "Timber", "stained", "AI Plan Takeoff / builder-added", true),
  exteriorColourArea("timber-beams", "Timber beams", "Timber and features", "Timber", "stained", "AI Plan Takeoff / builder-added", false),
  exteriorColourArea("timber-battens-screens", "Timber battens/screens", "Timber and features", "Timber", "stained", "Exterior material selections", false),
  exteriorColourArea("verandah-patio-posts", "Verandah or patio posts", "Timber and features", "Timber", "stained", "AI Plan Takeoff / builder-added", false),
  exteriorColourArea("balustrades", "Balustrades", "Timber and features", "Balustrade material", "painted", "Balustrade selections", false),
  exteriorColourArea("handrails", "Handrails", "Timber and features", "Handrail material", "painted", "Balustrade selections", false),
  exteriorColourArea("external-ceilings", "External ceilings", "Roofline", "Fibre cement", "painted", "AI Plan Takeoff", true),
  exteriorColourArea("meter-box", "Meter box", "Other items", "Metal enclosure", "painted", "Builder-added area", false),
  exteriorColourArea("custom-exterior-area", "Other custom exterior area", "Other items", "Custom", "painted", "Builder-added area", false),
];

export const EXTERIOR_COLOUR_PALETTE = [
  exteriorColour("dulux-dieskau-sn4h1", "Dulux", "Dulux Colours", "Dieskau", "SN4H1", "Greys", "#cbc9c5", 62, "Painted exterior surfaces", "https://www.dulux.com.au/", "standard", ["Greys", "Off-whites", "Beige and stone"], ["builder-standard", "supplier-popular"]),
  exteriorColour("dulux-lexicon-quarter-sw1e1", "Dulux", "Whites and Neutrals", "Lexicon Quarter", "SW1E1", "Whites", "#f1f2f1", 90, "Painted interior/exterior surfaces", "https://www.dulux.com.au/colour/whites-and-neutrals/lexicon-quarter/", "standard", ["Whites", "Off-whites"], ["builder-standard", "supplier-popular"]),
  exteriorColour("dulux-vivid-white-sw1g1", "Dulux", "Whites and Neutrals", "Vivid White", "SW1G1", "Whites", "#f7f8f4", 94, "Painted interior/exterior surfaces", "https://www.dulux.com.au/colour/whites-and-neutrals/vivid-white/", "standard", ["Whites"], ["builder-standard"]),
  exteriorColour("dulux-colorbond-monument-c29", "Dulux", "COLORBOND colours", "Colorbond Monument", "C29", "Charcoal", "#404141", 8, "Painted exterior trim / COLORBOND match", "https://www.dulux.com.au/colour/colorbond/colorbond-monument/", "standard", ["Charcoal", "Blacks", "Greys"], ["supplier-popular"]),
  exteriorColour("colorbond-monument", "COLORBOND", "COLORBOND steel", "Monument", "Manufacturer colour", "Charcoal", "#404141", null, "Factory-finished steel", "https://colorbond.com/colours/monument", "standard", ["Charcoal", "Blacks", "Greys"], ["supplier-popular"]),
  exteriorColour("colorbond-surfmist", "COLORBOND", "COLORBOND steel", "Surfmist", "Manufacturer colour", "Off-whites", "#d8d4c8", null, "Factory-finished steel", "https://colorbond.com/colours", "standard", ["Off-whites", "Whites"], ["builder-standard", "supplier-popular"]),
  exteriorColour("colorbond-dune", "COLORBOND", "COLORBOND steel", "Dune", "Manufacturer colour", "Beige and stone", "#b8ad9c", null, "Factory-finished steel", "https://colorbond.com/colours", "standard", ["Beige and stone", "Greys"], ["supplier-popular"]),
  exteriorColour("colorbond-paperbark", "COLORBOND", "COLORBOND steel", "Paperbark", "Manufacturer colour", "Creams", "#c5b596", null, "Factory-finished steel", "https://colorbond.com/colours", "standard", ["Creams", "Beige and stone"], ["supplier-popular"]),
  exteriorColour("colorbond-jasper", "COLORBOND", "COLORBOND steel", "Jasper", "Manufacturer colour", "Browns", "#6a4f43", null, "Factory-finished steel", "https://colorbond.com/colours", "standard", ["Browns"], ["supplier-popular"]),
  exteriorColour("colorbond-woodland-grey", "COLORBOND", "COLORBOND steel", "Woodland Grey", "Manufacturer colour", "Greens", "#4d5148", null, "Factory-finished steel", "https://colorbond.com/colours", "standard", ["Greens", "Greys", "Charcoal"], ["supplier-popular"]),
  exteriorColour("colorbond-pale-eucalypt", "COLORBOND", "COLORBOND steel", "Pale Eucalypt", "Manufacturer colour", "Greens", "#7c8b75", null, "Factory-finished steel", "https://colorbond.com/colours", "standard", ["Greens"], ["supplier-popular"]),
  exteriorColour("colorbond-mangrove", "COLORBOND", "COLORBOND steel", "Mangrove", "Manufacturer colour", "Greens", "#4b5948", null, "Factory-finished steel", "https://colorbond.com/colours", "standard", ["Greens", "Charcoal"], ["supplier-popular"]),
  exteriorColour("colorbond-cottage-green", "COLORBOND", "COLORBOND steel", "Cottage Green", "Manufacturer colour", "Greens", "#314635", null, "Factory-finished steel", "https://colorbond.com/colours", "standard", ["Greens"], ["supplier-popular"]),
  exteriorColour("colorbond-bluegum", "COLORBOND", "COLORBOND steel", "Blue Gum", "Manufacturer colour", "Blue-greens", "#7f8b8c", null, "Factory-finished steel", "https://colorbond.com/colours", "standard", ["Blue-greens", "Blues", "Greys"], ["supplier-popular"]),
  exteriorColour("colorbond-deep-ocean", "COLORBOND", "COLORBOND steel", "Deep Ocean", "Manufacturer colour", "Blues", "#364152", null, "Factory-finished steel", "https://colorbond.com/colours", "standard", ["Blues", "Charcoal"], ["supplier-popular"]),
  exteriorColour("colorbond-manor-red", "COLORBOND", "COLORBOND steel", "Manor Red", "Manufacturer colour", "Reds", "#5c2c28", null, "Factory-finished steel", "https://colorbond.com/colours", "standard", ["Reds"], ["supplier-popular"]),
  exteriorColour("colorbond-terrain", "COLORBOND", "COLORBOND steel", "Terrain", "Manufacturer colour", "Terracotta", "#8b4b3a", null, "Factory-finished steel", "https://colorbond.com/colours", "standard", ["Terracotta", "Reds", "Browns"], ["supplier-popular"]),
  exteriorColour("colorbond-classic-cream", "COLORBOND", "COLORBOND steel", "Classic Cream", "Manufacturer colour", "Creams", "#e9dcb3", null, "Factory-finished steel", "https://colorbond.com/colours", "standard", ["Creams", "Yellow"], ["supplier-popular"]),
  exteriorColour("custom-colour-match", "Custom colour", "Builder approved custom", "Custom colour match", "Record sample/reference", "Other", "#d9d5cd", null, "Builder-approved custom/sample match", "", "custom", ["Other"], []),
  exteriorColour("natural-timber-stain", "Builder/Painter", "Timber stain", "Natural stain", "Project sample", "Timber tones", "#9b6a3c", null, "Stained timber", "", "quote_required", ["Timber tones", "Browns"], ["builder-standard"]),
  exteriorColour("clear-timber-finish", "Builder/Painter", "Timber finish", "Clear finish", "Project sample", "Timber tones", "#c69b6d", null, "Clear finished timber", "", "quote_required", ["Timber tones", "Browns"], []),
];

export const EXTERIOR_COLOUR_SCHEMES = [
  {
    schemeId: "light-contemporary",
    name: "Scheme 1 - Light Contemporary",
    coloursByArea: {
      "main-rendered-walls": "dulux-dieskau-sn4h1",
      "secondary-rendered-walls": "dulux-colorbond-monument-c29",
      "painted-wall-cladding": "dulux-dieskau-sn4h1",
      "eaves-soffits": "dulux-lexicon-quarter-sw1e1",
      fascia: "dulux-lexicon-quarter-sw1e1",
      gutters: "colorbond-surfmist",
      downpipes: "colorbond-surfmist",
      "window-surrounds": "dulux-vivid-white-sw1g1",
      "door-surrounds": "dulux-vivid-white-sw1g1",
      "garage-door-surround": "dulux-vivid-white-sw1g1",
      "timber-posts": "natural-timber-stain",
      "external-ceilings": "dulux-lexicon-quarter-sw1e1",
    },
  },
  {
    schemeId: "dark-contemporary",
    name: "Scheme 2 - Dark Contemporary",
    coloursByArea: {
      "main-rendered-walls": "dulux-dieskau-sn4h1",
      "secondary-rendered-walls": "dulux-colorbond-monument-c29",
      "painted-wall-cladding": "dulux-colorbond-monument-c29",
      "eaves-soffits": "dulux-vivid-white-sw1g1",
      fascia: "dulux-colorbond-monument-c29",
      gutters: "colorbond-monument",
      downpipes: "colorbond-monument",
      "window-surrounds": "dulux-vivid-white-sw1g1",
      "door-surrounds": "dulux-vivid-white-sw1g1",
      "garage-door-surround": "dulux-colorbond-monument-c29",
      "timber-posts": "natural-timber-stain",
      "external-ceilings": "dulux-vivid-white-sw1g1",
    },
  },
];

export const EXTERIOR_COLOUR_STATUS_META = {
  not_selected: { label: "Not selected", tone: "grey", icon: "o" },
  selection_required: { label: "Selection required", tone: "grey", icon: "o" },
  colour_selected: { label: "Applied", tone: "teal", icon: "ok" },
  linked_roofing: { label: "Linked to Roofing", tone: "blue", icon: "link" },
  linked_windows: { label: "Linked to Windows", tone: "blue", icon: "link" },
  linked_garage_door: { label: "Linked to Garage Door", tone: "blue", icon: "link" },
  linked_cladding: { label: "Linked to Cladding", tone: "blue", icon: "link" },
  not_painted: { label: "Not painted", tone: "grey", icon: "-" },
  material_finish: { label: "Material finish - no paint", tone: "blue", icon: "link" },
  needs_client_confirmation: { label: "Needs client confirmation", tone: "amber", icon: "!" },
  confirmed: { label: "Confirmed", tone: "green", icon: "ok" },
  quote_required: { label: "Quote required", tone: "amber", icon: "$" },
  incompatible_selection: { label: "Incompatible selection", tone: "red", icon: "!" },
};

const BND_COLOUR_SOURCE_URL = "https://www.bnd.com.au/product-detail/panelift/";
const BND_DESIGN_COLOUR_SOURCE_URL = "https://www.bnd.com.au/explore/explore-designs-and-colours/";
const BND_TIMBER_LOOK_SOURCE_URL = "https://www.bnd.com.au/garage-doors/residential/designer/wooden-and-timber-look/";
const BND_VERIFIED_DATE = "2026-08-27";

const BND_STANDARD_COLOUR_HEX = {
  "Dover White": "#f7f6ef",
  "Classic Cream": "#e9dcb3",
  Surfmist: "#d8d4c8",
  Sandbank: "#c8b99d",
  Paperbark: "#c5b596",
  Stone: "#b7a88b",
  Dune: "#b8ad9c",
  "Shale Grey": "#b5b9b3",
  Southerly: "#d2d1c8",
  "Evening Haze": "#c9c2af",
  Cove: "#9f9c8f",
  "Pale Eucalypt": "#7c8b75",
  Mangrove: "#4b5948",
  "Cottage Green": "#314635",
  "Woodland Grey": "#4d5148",
  Gully: "#857f70",
  Wallaby: "#7a7369",
  Jasper: "#6a4f43",
  Terrain: "#8b4b3a",
  "Manor Red": "#5c2c28",
  Ironstone: "#4f4b42",
  "Deep Ocean": "#364152",
  Windspray: "#8c9694",
  "Blue Gum": "#7f8b8c",
  Basalt: "#5a5a55",
  Monument: "#323232",
  "Night Sky": "#1f1f20",
};

const BND_TIMBER_LOOK_HEX = {
  "Timbergrain Classic Cedar": "#9a6034",
  "Timbergrain Caoba": "#765037",
  "Nordic Oak": "#bda47b",
  "Tassie Oak": "#a97943",
  "Australian Cedar": "#a85f32",
  "Red Gum": "#7c3f2f",
  "Southern Cedar": "#8b5635",
  "Black Walnut": "#46342b",
  "Black Wenge": "#2d2521",
  "Silver Wattle": "#8c8170",
  "Spotted Gum": "#9b6f45",
  Blackbutt: "#b9905f",
  "Western Red Cedar": "#8c4d32",
  Merbau: "#6d3324",
};

export const GARAGE_DOOR_COLOUR_CATALOGUE = [
  ...Object.entries(BND_STANDARD_COLOUR_HEX).map(([name, hex]) => garageDoorColour({
    name,
    hex,
    family: "Standard COLORBOND",
    finishType: "COLORBOND steel",
    classification: "standard",
    compatibleDoorTypes: ["Sectional", "Roller"],
    compatibleProfiles: ["Nullarbor", "Seville", "Madrid", "Statesman", "Grange", "Roller door"],
    sourceUrl: BND_COLOUR_SOURCE_URL,
  })),
  ...Object.entries(BND_TIMBER_LOOK_HEX).map(([name, hex], index) => garageDoorColour({
    name,
    hex,
    family: name.startsWith("Timbergrain") ? "Timbergrain" : "Timber-look",
    finishType: name.startsWith("Timbergrain") ? "COLORBOND Timbergrain" : "B&D timber-look steel finish",
    classification: "premium",
    compatibleDoorTypes: ["Sectional"],
    compatibleProfiles: index < 9 ? ["Nullarbor", "Seville", "Madrid"] : ["Nullarbor"],
    sourceUrl: name.startsWith("Timbergrain") ? BND_COLOUR_SOURCE_URL : BND_TIMBER_LOOK_SOURCE_URL,
    leadTimeWarning: "Premium timber-look finish. Confirm lead time with B&D dealer before ordering.",
    quoteRequired: true,
  })),
  garageDoorColour({
    name: "Sheer Panel finish",
    hex: "#1f2933",
    family: "Premium designer finishes",
    finishType: "B&D Sheer Panel",
    classification: "designer",
    compatibleDoorTypes: ["Designer/profile range"],
    compatibleProfiles: ["Designer finish profile by quote"],
    sourceUrl: BND_DESIGN_COLOUR_SOURCE_URL,
    leadTimeWarning: "Designer finish by supplier quote.",
    quoteRequired: true,
  }),
];

function garageDoorColour({
  name,
  hex,
  family,
  finishType,
  classification,
  compatibleDoorTypes,
  compatibleProfiles,
  sourceUrl,
  leadTimeWarning = "",
  quoteRequired = false,
}) {
  const slugged = slugValue(name);
  return {
    colourId: `bnd-${slugged}`,
    supplierId: "bnd",
    supplierName: "B&D Australia",
    productRange: "B&D residential garage doors",
    compatibleDoorTypes,
    compatibleProfiles,
    officialName: name,
    supplierCode: "",
    colorbondName: family.includes("COLORBOND") || finishType.includes("COLORBOND") ? name : "",
    finishFamily: family,
    finishType,
    swatchValue: hex,
    classification,
    priceStatus: quoteRequired ? PRICE_STATES.quoteRequired : PRICE_STATES.allowanceOnly,
    includedStatus: quoteRequired ? "quote_required" : "included",
    regionalAvailability: ["AU", "QLD"],
    leadTimeWarning,
    restrictions: quoteRequired ? "Supplier quotation required before ordering." : "Confirm colour using current B&D physical sample before ordering.",
    sourceUrl,
    verifiedAt: BND_VERIFIED_DATE,
    active: true,
    discontinued: false,
  };
}

const PRODUCT_STATUS_FIELDS = ["priceStatus", "price_status", "model_status"];
const CLASSIFICATION_TYPES = {
  requirement: "requirement",
  productFamily: "product_family",
  allowanceSpecification: "allowance_specification",
  variant: "variant",
  actualProduct: "actual_product",
};

export function kitchenRequirementByKey(requirementKey) {
  return KITCHEN_REQUIREMENTS.find((item) => item.requirementKey === requirementKey) || null;
}

export function guidedRequirementByKey(requirementKey) {
  return ALL_GUIDED_REQUIREMENTS.find((item) => item.requirementKey === requirementKey) || null;
}

export function selectionKeyForRequirement(requirement) {
  return `${requirement.areaKey}:${requirement.requirementKey}`;
}

export function selectionMatchesRequirement(selection, requirement) {
  if (!selection || !requirement) return false;
  const metadata = selection.metadata || {};
  const details = selection.selected_details || {};
  const matchesRequirement =
    metadata.requirementKey === requirement.requirementKey ||
    details.requirementKey === requirement.requirementKey ||
    metadata.familyKey === requirement.familyKey ||
    details.familyKey === requirement.familyKey;
  if (requirement.areaKey === APPLIANCE_AREA_KEY && matchesRequirement) {
    const legacyArea = metadata.area || details.area || selection.category || selection.room || "";
    if (!legacyArea || ["appliances", "kitchen"].includes(String(legacyArea).toLowerCase())) return true;
  }
  if (requirement.requirementKey === "cabinetry" && matchesRequirement) {
    const legacyArea = metadata.area || details.area || selection.category || selection.room || "";
    if (!legacyArea || ["cabinetry", "kitchen"].includes(String(legacyArea).toLowerCase())) return true;
  }
  if (requirement.areaKey === PLUMBING_FIXTURE_AREA_KEY && matchesRequirement) {
    const legacyArea = metadata.area || details.area || selection.category || selection.room || "";
    if (!legacyArea || ["plumbing-fixtures", "plumbing fixtures", "kitchen", "bathroom", "ensuite", "laundry"].includes(String(legacyArea).toLowerCase())) return true;
  }
  return (
    metadata.area === requirement.areaKey ||
    details.area === requirement.areaKey ||
    selection.room?.toLowerCase() === requirement.areaKey
  ) && matchesRequirement;
}

export function selectedByRequirement(selections = [], requirements = KITCHEN_REQUIREMENTS) {
  const map = new Map();
  requirements.forEach((requirement) => {
    const matched = selections
      .filter((selection) => selection?.is_active !== false && !["replaced", "removed"].includes(selection?.selection_status || selection?.status))
      .filter((selection) => selectionMatchesRequirement(selection, requirement))
      .sort((a, b) => String(b.updated_at || b.selected_at || b.created_at || "").localeCompare(String(a.updated_at || a.selected_at || a.created_at || "")))[0];
    if (matched) map.set(requirement.requirementKey, matched);
  });
  return map;
}

export function nextIncompleteRequirement(requirements = ALL_GUIDED_REQUIREMENTS, selectionMap = new Map(), currentRequirement = null) {
  const currentIndex = requirements.findIndex((requirement) => requirement.requirementKey === currentRequirement?.requirementKey);
  const ordered = currentIndex >= 0
    ? [...requirements.slice(currentIndex + 1), ...requirements.slice(0, currentIndex + 1)]
    : requirements;
  return ordered.find((requirement) => statusForRequirement(requirement, selectionMap.get(requirement.requirementKey)) !== "complete") || null;
}

export function priceStateForProduct(product = {}) {
  const raw = PRODUCT_STATUS_FIELDS.map((field) => product[field]).find(Boolean) || product.metadata?.priceStatus || product.metadata?.productEntity?.priceStatus || "";
  const normalised = String(raw || "").toLowerCase();
  const price = productClientPrice(product);
  if (price > 0 && !normalised.includes("expired") && !normalised.includes("pending") && !normalised.includes("quote")) return PRICE_STATES.current;
  if (normalised.includes("expired")) return PRICE_STATES.expired;
  if (normalised.includes("quote")) return PRICE_STATES.quoteRequired;
  if (normalised.includes("pending") || normalised.includes("review") || product.priceReviewRequired || product.metadata?.productEntity?.priceReviewRequired) return PRICE_STATES.pending;
  if (price > 0) return PRICE_STATES.current;
  const allowance = productAllowance(product);
  if (allowance > 0) return PRICE_STATES.allowanceOnly;
  return PRICE_STATES.pending;
}

export function statusForRequirement(requirement, selection = null) {
  if (!selection) return "not_started";
  if (selection.selection_status === "not_applicable" || selection.selected_details?.notApplicable) return "complete";
  const state = selection.selected_details?.priceState || selection.metadata?.priceState || "";
  if (requirement?.requirementKey === "roofing" && selection.selected_details?.configurationComplete) return "complete";
  if (selection.selected_details?.variationPending && ["selected", "approved"].includes(selection.selection_status || selection.status)) return "complete";
  if ([PRICE_STATES.pending, PRICE_STATES.quoteRequired, PRICE_STATES.expired].includes(state)) return "incomplete";
  if (["selected", "approved"].includes(selection.selection_status || selection.status)) return "complete";
  if (selection.status === "selected" || selection.status === "approved") return "complete";
  return "incomplete";
}

export function statusTone(status) {
  if (status === "complete") return "green";
  if (status === "incomplete") return "amber";
  if (status === "problem") return "red";
  return "grey";
}

export function productClientPrice(product = {}) {
  const entity = product.metadata?.productEntity || product;
  return numberValue(
    entity.clientPrice
      ?? entity.client_price
      ?? entity.selected_cost
      ?? entity.current_listed_price
      ?? product.clientPrice
      ?? product.client_price
      ?? product.selected_cost
      ?? product.current_listed_price
      ?? product.upgrade_cost
      ?? product.client_selection_price
  );
}

export function productAllowance(product = {}, requirement = null) {
  const entity = product.metadata?.productEntity || product;
  const explicit = numberValue(entity.allowance ?? product.allowance ?? product.base_allowance ?? product.allowance_amount);
  return explicit || numberValue(requirement?.defaultAllowance);
}

export function variationFor({ selectedPrice = 0, allowance = 0, quantity = 1 } = {}) {
  return roundMoney((numberValue(selectedPrice) - numberValue(allowance)) * (numberValue(quantity) || 1));
}

export function requirementFinancials(requirement, selection = null) {
  const allowance = numberValue(selection?.included_allowance ?? selection?.allowance_amount ?? selection?.selected_details?.allowance ?? requirement?.defaultAllowance);
  if (!selection) {
    return {
      allowance,
      selectedPrice: 0,
      quantity: numberValue(requirement?.defaultQuantity) || 1,
      variation: 0,
    };
  }
  const selectedPrice = numberValue(selection?.client_selection_price ?? selection?.selected_details?.selectedPrice ?? selection?.selected_details?.clientSelectionPrice);
  const quantity = numberValue(selection?.selected_details?.quantity ?? requirement?.defaultQuantity ?? 1) || 1;
  if (selection?.selected_details?.variationPending) {
    return {
      allowance,
      selectedPrice: 0,
      quantity,
      variation: 0,
    };
  }
  return {
    allowance,
    selectedPrice,
    quantity,
    variation: roundMoney(numberValue(selection?.variation_amount ?? selection?.selected_details?.variationAmount ?? variationFor({ selectedPrice, allowance, quantity }))),
  };
}

export function areaTotals(requirements = KITCHEN_REQUIREMENTS, selectionMap = new Map()) {
  return requirements.reduce((totals, requirement) => {
    const financials = requirementFinancials(requirement, selectionMap.get(requirement.requirementKey));
    totals.allowance = roundMoney(totals.allowance + financials.allowance);
    totals.selected = roundMoney(totals.selected + financials.selectedPrice * financials.quantity);
    totals.variation = roundMoney(totals.variation + financials.variation);
    totals.completed += statusForRequirement(requirement, selectionMap.get(requirement.requirementKey)) === "complete" ? 1 : 0;
    totals.total += 1;
    return totals;
  }, { allowance: 0, selected: 0, variation: 0, completed: 0, total: 0 });
}

export function projectTotals(areaTotalList = []) {
  return areaTotalList.reduce((totals, area) => ({
    allowance: roundMoney(totals.allowance + numberValue(area.allowance)),
    selected: roundMoney(totals.selected + numberValue(area.selected)),
    variation: roundMoney(totals.variation + numberValue(area.variation)),
    completed: totals.completed + numberValue(area.completed),
    total: totals.total + numberValue(area.total),
  }), { allowance: 0, selected: 0, variation: 0, completed: 0, total: 0 });
}

export function productsForRequirement(products = [], requirement) {
  const family = familyByKey(requirement?.familyKey);
  const candidateFamilyKeys = familyKeysForRequirement(requirement, family);
  if (!candidateFamilyKeys.length) return [];
  return products.filter((product) => {
    if (isRemovedDuplicateCladdingProduct(product)) return false;
    if (isClientSelectionsExcludedProduct(product, requirement)) return false;
    if (!isProductLibraryEligibleProduct(product)) return false;
    const entity = product.metadata?.productEntity || product;
    const rowType = entity.rowClassification || product.rowClassification || product.metadata?.rowClassification || classifyApprovedSelectionRow(entity);
    const hasCanonicalProductIdentity = Boolean(entity.productId || product.productId || entity.productCode || product.productCode);
    if (requirement?.areaKey === "exterior"
      && !hasCanonicalProductIdentity
      && [CLASSIFICATION_TYPES.allowanceSpecification, CLASSIFICATION_TYPES.variant].includes(rowType)) return false;
    if (entity.organisationId && product.organisationId && entity.organisationId !== product.organisationId) return false;
    const explicitArea = entity.topLevelArea || product.topLevelArea || product.metadata?.topLevelArea;
    const explicitFamily = entity.familyKey || product.familyKey || product.metadata?.familyKey;
    const quoteCode = entity.linkedQuoteItemCode || product.linkedQuoteItemCode || product.quote_structure_row_id;
    const matchesRequiredQuote = !family || !requirement.linkedQuoteItemCode || !quoteCode || quoteCode === requirement.linkedQuoteItemCode || quoteCode === family.linkedQuoteItemCode || quoteCode === family.approvedSourceKey;
    const matchesFamily = explicitFamily
      ? candidateFamilyKeys.includes(explicitFamily)
      : Boolean(family && productMatchesFamily(entity, family));
    return productAreaMatchesRequirement(explicitArea, requirement) && matchesFamily && productSubtypeMatchesRequirement(entity, requirement) && matchesRequiredQuote;
  });
}

function familyKeysForRequirement(requirement = {}, family = null) {
  if (family) return [family.familyKey];
  const key = requirement?.familyKey || requirement?.requirementKey || "";
  const aliases = {
    basins: ["tapware"],
    "basin-mixers": ["tapware"],
    baths: ["tapware"],
    "shower-fixtures": ["tapware"],
    toilets: ["tapware"],
    "laundry-tubs": ["kitchen-sinks"],
    "laundry-mixers": ["kitchen-sink-mixers", "tapware"],
    "visual-interior-paint": ["paint"],
    "visual-interior-lighting": ["lighting"],
    "visual-kitchen": ["cabinetry", "kitchen-sinks", "kitchen-sink-mixers"],
    "visual-bathroom": ["tapware", "tiles", "cabinetry"],
    "visual-ensuite": ["tapware", "tiles", "cabinetry"],
    "visual-laundry": ["kitchen-sinks", "kitchen-sink-mixers", "cabinetry", "tiles"],
  };
  return aliases[key] || (requirement?.familyKey ? [requirement.familyKey] : []);
}

function productAreaMatchesRequirement(explicitArea = "", requirement = {}) {
  if (!explicitArea) return true;
  if (explicitArea === requirement.areaKey) return true;
  if (requirement.areaKey === APPLIANCE_AREA_KEY && explicitArea === KITCHEN_AREA_KEY) return true;
  if (requirement.areaKey === PLUMBING_FIXTURE_AREA_KEY && ["kitchen", "bathroom-ensuite", "laundry"].includes(explicitArea)) return true;
  if (requirement.areaKey === "interior" && ["kitchen", "bathroom-ensuite", "laundry", "interior"].includes(explicitArea)) return true;
  return false;
}

function productSubtypeMatchesRequirement(entity = {}, requirement = {}) {
  const fixtureType = String(entity.attributes?.fixtureType || entity.categoryKey || entity.productName || "").toLowerCase();
  if (requirement?.familyKey === "basins") return /basin/.test(fixtureType) && !/mixer/.test(fixtureType);
  if (requirement?.familyKey === "basin-mixers") return /basin-mixer|mixer/.test(fixtureType);
  if (requirement?.familyKey === "baths") return /bath/.test(fixtureType);
  if (requirement?.familyKey === "shower-fixtures") return /shower/.test(fixtureType);
  if (requirement?.familyKey === "toilets") return /toilet/.test(fixtureType);
  if (requirement?.familyKey === "laundry-tubs") return /sink|tub/.test(fixtureType) || entity.familyKey === "kitchen-sinks";
  if (requirement?.familyKey === "laundry-mixers") return /mixer|tap/.test(fixtureType) || entity.familyKey === "kitchen-sink-mixers";
  return true;
}

function isClientSelectionsExcludedProduct(product = {}, requirement = {}) {
  if (requirement?.requirementKey !== "garage-door" && requirement?.familyKey !== "garage-doors") return false;
  const entity = product?.metadata?.productEntity || product || {};
  const haystack = [
    entity.productName,
    entity.product_name,
    entity.description,
    entity.category,
    entity.subcategory,
    entity.family,
    entity.familyKey,
    entity.productCode,
    product.productName,
    product.product_name,
    product.description,
    product.category,
    product.subcategory,
    product.family,
    product.familyKey,
    product.productCode,
  ].filter(Boolean).join(" ");
  return /\bgarage\s*door\s*jambs?\b|\bjambs?\b/i.test(haystack);
}

export function requirementImage(requirement, product = null) {
  return resolveSelectionImage({ product, requirement });
}

export function resolveSelectionImage({ product = null, requirement = null, exactProductImage = "", exactRangeImage = "", familyKey = "", categoryKey = "", areaKey = "" } = {}) {
  const entity = product?.metadata?.productEntity || product || {};
  const variantImage = firstField(entity, ["variantImage", "variant_image_url", "colourImage", "colour_image_url", "swatchImage", "swatch_image_url"]) || firstField(product || {}, ["variantImage", "variant_image_url", "colourImage", "colour_image_url", "swatchImage", "swatch_image_url"]);
  if (variantImage) return variantImage;
  return resolveProductLibraryImage({
    product,
    exactProductImage,
    exactRangeImage,
    familyKey: familyKey || requirement?.familyKey || entity.familyKey || product?.familyKey,
    categoryKey: categoryKey || requirement?.imageKey || requirement?.requirementKey || entity.categoryKey || entity.requirementKey,
    areaKey: areaKey || requirement?.areaKey || entity.topLevelArea || product?.topLevelArea,
  }) || placeholderSelectionImage(requirement?.label || entity.category || entity.productName || "Selection");
}

export function classifyApprovedSelectionRow(row = {}) {
  const source = String(row.sourceDescription || row.description || row.productName || row.product_name || row.itemDescription || "").trim();
  const textValue = source.toUpperCase();
  if (!textValue) return CLASSIFICATION_TYPES.requirement;
  if (/\b(COLOU?R|FINISH)\b/.test(textValue)) return CLASSIFICATION_TYPES.variant;
  if (/\bPC SUM\b|\bALLOWANCE\b|\bAS PER\b|\bTO BE SELECTED\b|\bSELECTION\b/.test(textValue)) return CLASSIFICATION_TYPES.allowanceSpecification;
  if (/\bFACE BRICKS?\b.*\bRANGE\b|\bRANGE\b$/.test(textValue)) return CLASSIFICATION_TYPES.allowanceSpecification;
  if (/\b(ROOF TILES?|METAL ROOFING|GUTTERING|FASCIAS?|DOWNPIPES?|CLADDING|BRICKWORK)\b/.test(textValue)) return CLASSIFICATION_TYPES.productFamily;
  if (row.productSpecific === true || row.exactProductName || row.model || row.identifiableModel) return CLASSIFICATION_TYPES.actualProduct;
  if (row.brand || row.identifiableBrand) return CLASSIFICATION_TYPES.actualProduct;
  if (row.familyKey) return CLASSIFICATION_TYPES.productFamily;
  return CLASSIFICATION_TYPES.requirement;
}

export function createSelectionPayloadFromProduct({ workspaceId, projectId, snapshotId, sessionId, requirement, product, userId = null, quantity } = {}) {
  const entity = product.metadata?.productEntity || product;
  const rawSelectedPrice = productClientPrice(product);
  const allowance = productAllowance(product, requirement);
  const selectedQuantity = numberValue(quantity ?? requirement.defaultQuantity) || 1;
  const priceState = priceStateForProduct(product);
  const complete = priceState === PRICE_STATES.current || priceState === PRICE_STATES.allowanceOnly;
  const variationPending = !complete;
  const selectedPrice = complete ? rawSelectedPrice : null;
  const variation = complete ? variationFor({ selectedPrice, allowance, quantity: selectedQuantity }) : null;
  return {
    workspace_id: workspaceId,
    project_id: projectId,
    snapshot_id: snapshotId || null,
    session_id: sessionId || null,
    source_quote_row_id: entity.linkedQuoteItemCode || product.quote_structure_row_id || requirement.linkedQuoteItemCode || null,
    category: requirement.areaKey,
    subcategory: requirement.label,
    room: requirement.areaLabel,
    title: requirement.label,
    description: entity.description || product.description || "",
    included_in_contract: variation === 0,
    allowance_amount: allowance,
    selected_product_name: entity.productName || product.product_name || "",
    selected_supplier_name: entity.supplier || product.supplier || "",
    selected_colour: entity.colour || product.colour || "",
    selected_finish: entity.finish || product.finish || "",
    selected_details: {
      area: requirement.areaKey,
      areaLabel: requirement.areaLabel,
      requirementKey: requirement.requirementKey,
      requirementLabel: requirement.label,
      familyKey: requirement.familyKey,
      selectionKey: selectionKeyForRequirement(requirement),
      productLibrarySelectionKey: selectionKeyForFamily(familyByKey(requirement.familyKey)),
      productId: product.productId || product.id || "",
      productCode: entity.productCode || product.sku || "",
      manufacturer: entity.manufacturer || product.manufacturer || "",
      brand: entity.brand || product.brand || "",
      supplier: entity.supplier || product.supplier || "",
      range: entity.range || product.range || "",
      productName: entity.productName || product.product_name || "",
      model: entity.model || product.model || "",
      colour: entity.colour || product.colour || "",
      finish: entity.finish || product.finish || "",
      size: entity.size || product.size || "",
      profile: entity.profile || product.profile || "",
      texture: entity.texture || product.texture || "",
      configuration: entity.configuration || product.configuration || "",
      selectedConfiguration: entity.attributes?.selectedConfiguration || entity.configuration || product.configuration || "",
      frameMaterial: entity.attributes?.frameMaterial || product.attributes?.frameMaterial || "",
      frameColour: entity.attributes?.frameColour || entity.colour || product.attributes?.frameColour || product.colour || "",
      glassType: entity.attributes?.glassType || product.attributes?.glassType || "",
      doorDesign: entity.attributes?.design || entity.model || product.attributes?.design || product.model || "",
      glazing: entity.attributes?.selectedGlazing || entity.attributes?.glazing || entity.glazing || product.glazing || product.attributes?.glazing || "",
      hardwareCompatibility: entity.attributes?.selectedHardware || entity.attributes?.hardwareCompatibility || entity.hardwareCompatibility || product.hardwareCompatibility || product.attributes?.hardwareCompatibility || "",
      selectedHardware: entity.attributes?.selectedHardware || entity.hardwareCompatibility || product.hardwareCompatibility || "",
      doorThickness: entity.attributes?.doorThickness || product.attributes?.doorThickness || "",
      materialConstruction: entity.attributes?.materialConstruction || entity.material || product.material || "",
      balRating: entity.attributes?.balRating || product.attributes?.balRating || "",
      warrantyInformation: entity.attributes?.warrantyInformation || product.attributes?.warrantyInformation || "",
      dataSourceUrl: entity.attributes?.dataSourceUrl || entity.sourceUrl || product.sourceUrl || "",
      selectedPrice,
      allowance,
      quantity: selectedQuantity,
      unit: requirement.unit,
      variationAmount: variation,
      variationPending,
      priceState,
      priceStatus: priceState,
      selectedVariant: entity.variants?.[0] || null,
      imageReference: requirementImage(requirement, entity),
      officialProductURL: entity.officialProductURL || entity.officialProductUrl || product.officialProductURL || product.officialProductUrl || product.product_url || product.productUrl || "",
      garageDoorSelection: product.garageDoorSelection || entity.garageDoorSelection || null,
      garageDoorSchedule: product.garageDoorSchedule || entity.garageDoorSchedule || [],
      externalLightingSelection: product.externalLightingSelection || entity.externalLightingSelection || null,
      lightingSchedule: product.lightingSchedule || entity.lightingSchedule || [],
      electricalContractorSchedule: product.electricalContractorSchedule || entity.electricalContractorSchedule || [],
      procurementSchedule: product.procurementSchedule || entity.procurementSchedule || [],
      exteriorColourSelection: product.exteriorColourSelection || entity.exteriorColourSelection || null,
      clientColourSchedule: product.clientColourSchedule || entity.clientColourSchedule || [],
      painterTradeSchedule: product.painterTradeSchedule || entity.painterTradeSchedule || [],
      technicalCoatingRecords: product.technicalCoatingRecords || entity.technicalCoatingRecords || [],
      supplierProcurementStatus: product.supplierProcurementStatus || entity.supplierProcurementStatus || "",
    },
    status: "selected",
    selected_at: new Date().toISOString(),
    metadata: {
      source: "client_selection_checklist",
      area: requirement.areaKey,
      requirementKey: requirement.requirementKey,
      familyKey: requirement.familyKey,
      priceState,
      priceStatus: priceState,
      variationPending,
    },
    notes: "",
    created_by: userId,
    updated_by: userId,
    brand: entity.brand || "",
    product_name: entity.productName || product.product_name || "",
    model_number: entity.model || product.model || "",
    image_url: requirementImage(requirement, entity),
    specification_url: entity.specificationURL || product.datasheet_pdf_url || "",
    finish: entity.finish || "",
    colour: entity.colour || "",
    included_allowance: allowance,
    client_selection_price: selectedPrice,
    calculated_client_selection_price: selectedPrice,
    variation_amount: variation,
    selection_status: "selected",
    is_included_selection: variation === 0,
    is_active: true,
  };
}

export function garageDoorEnabledSupplierOptions(products = []) {
  const map = new Map();
  products.forEach((product) => {
    const supplierName = garageDoorSupplierName(product);
    if (!supplierName) return;
    const supplierId = garageDoorSupplierId(product);
    const existing = map.get(supplierId) || { supplierId, supplierName, label: supplierName, count: 0 };
    existing.count += 1;
    map.set(supplierId, existing);
  });
  return Array.from(map.values()).sort((left, right) => left.label.localeCompare(right.label));
}

export function garageDoorProductsForSupplier(products = [], supplierId = "") {
  return products.filter((product) => !supplierId || garageDoorSupplierId(product) === supplierId);
}

export function garageDoorRangeOptions(products = [], supplierId = "") {
  return Array.from(new Set(garageDoorProductsForSupplier(products, supplierId).map((product) => product.range || product.model || "Garage Door").filter(Boolean))).sort();
}

export function garageDoorProfileOptions(product = {}) {
  const attrs = garageDoorAttributes(product);
  const raw = attrs.profile || product.profile || "";
  if (/Panelift/i.test(`${product.range} ${product.model}`)) {
    const base = ["Nullarbor", "Seville", "Madrid", "Statesman", "Grange"];
    if (/Icon/i.test(`${product.range} ${product.model}`)) return base;
    return base;
  }
  if (/Roll-A-Door/i.test(`${product.range} ${product.model}`)) return ["Roller door"];
  if (/Designer/i.test(`${product.range} ${product.model}`)) return ["Designer finish profile by quote"];
  return raw ? raw.split(/[;,]/).map((item) => item.replace(/\bshown\b/ig, "").trim()).filter(Boolean) : ["Project nominated profile"];
}

export function garageDoorSizeOptions(product = {}) {
  const attrs = garageDoorAttributes(product);
  return Array.isArray(attrs.sizeOptions) && attrs.sizeOptions.length ? attrs.sizeOptions : [product.size || "Project garage opening"];
}

export function garageDoorColourOptionsForProduct(product = {}, { profile = "", search = "", family = "" } = {}) {
  const supplierId = garageDoorSupplierId(product);
  const doorType = garageDoorDoorType(product);
  const normalisedProfile = profile || garageDoorProfileOptions(product)[0] || "";
  const term = String(search || "").trim().toLowerCase();
  return GARAGE_DOOR_COLOUR_CATALOGUE
    .filter((colour) => colour.active && colour.supplierId === supplierId)
    .filter((colour) => garageDoorColourCompatible(colour, { doorType, profile: normalisedProfile }))
    .filter((colour) => !family || colour.finishFamily === family)
    .filter((colour) => !term || `${colour.officialName} ${colour.finishFamily} ${colour.finishType}`.toLowerCase().includes(term))
    .sort((left, right) => left.finishFamily.localeCompare(right.finishFamily) || left.officialName.localeCompare(right.officialName));
}

export function garageDoorColourById(colourId = "") {
  return GARAGE_DOOR_COLOUR_CATALOGUE.find((colour) => colour.colourId === colourId) || null;
}

export function garageDoorColourCompatible(colour = {}, { doorType = "", profile = "" } = {}) {
  const type = String(doorType || "").toLowerCase();
  const profileValue = String(profile || "").toLowerCase();
  const typeMatch = !colour.compatibleDoorTypes?.length || colour.compatibleDoorTypes.some((item) => type === String(item).toLowerCase());
  const profileMatch = !colour.compatibleProfiles?.length || colour.compatibleProfiles.some((item) => profileValue === String(item).toLowerCase());
  return typeMatch && profileMatch;
}

export function garageDoorFinishFamiliesForProduct(product = {}, profile = "") {
  return Array.from(new Set(garageDoorColourOptionsForProduct(product, { profile }).map((colour) => colour.finishFamily)));
}

export function garageDoorAutomationOptions(product = {}) {
  const doorType = garageDoorDoorType(product);
  if (/roller/i.test(doorType)) return ["Manual operation", "B&D roller door opener - quote required"];
  if (/designer/i.test(doorType)) return ["B&D opener by supplier quote", "Manual operation"];
  return ["Manual operation", "B&D sectional door opener - quote required"];
}

export function garageDoorAccessoryOptions(product = {}) {
  const doorType = garageDoorDoorType(product);
  const base = ["Two remote controls", "Wall button"];
  if (/sectional/i.test(doorType)) return [...base, "Safety beams - quote required", "Auto-Lock - B&D compatible where available", "Insulation - quote required"];
  if (/roller/i.test(doorType)) return [...base, "Safety beams - quote required", "Smart phone control - quote required"];
  return [...base, "Supplier confirmed accessories - quote required"];
}

export function garageDoorWorkflowProduct(product = {}, requirement = {}, configuration = {}) {
  const colour = garageDoorColourById(configuration.colourId);
  const profile = configuration.profile || garageDoorProfileOptions(product)[0] || "";
  const size = configuration.size || garageDoorSizeOptions(product)[0] || "Project garage opening";
  const automation = configuration.automation || garageDoorAutomationOptions(product)[0] || "";
  const accessories = configuration.accessories || [];
  const quantity = numberValue(configuration.quantity || requirement.defaultQuantity) || 1;
  const priceState = colour?.priceStatus === PRICE_STATES.quoteRequired || priceStateForProduct(product) === PRICE_STATES.quoteRequired ? PRICE_STATES.quoteRequired : PRICE_STATES.allowanceOnly;
  const allowance = productAllowance(product, requirement);
  const selectedPrice = priceState === PRICE_STATES.quoteRequired ? null : productClientPrice(product);
  const variation = selectedPrice == null ? null : variationFor({ selectedPrice, allowance, quantity });
  const supplier = garageDoorSupplierName(product);
  const range = product.range || product.model || "";
  const doorType = garageDoorDoorType(product);
  const garageDoorSelection = {
    projectGarageDoorId: configuration.location || "GD01",
    location: configuration.location || "GD01",
    supplierId: garageDoorSupplierId(product),
    supplier,
    range,
    doorType,
    profile,
    material: product.material || garageDoorAttributes(product).material || "Garage door system",
    size,
    openingWidth: configuration.openingWidth || "",
    openingHeight: configuration.openingHeight || "",
    quantity,
    colourId: colour?.colourId || "",
    officialColourName: colour?.officialName || "",
    supplierColourCode: colour?.supplierCode || "",
    finishFamily: colour?.finishFamily || "",
    finishType: colour?.finishType || "",
    swatchValue: colour?.swatchValue || "",
    colourSourceUrl: colour?.sourceUrl || "",
    colourVerifiedAt: colour?.verifiedAt || "",
    colourPricingStatus: colour?.priceStatus || "",
    operation: automation,
    motorOperator: automation,
    remotes: accessories.includes("Two remote controls") ? "Two remote controls" : "",
    accessories,
    allowance,
    quotedCost: selectedPrice,
    variation,
    quoteRequired: priceState === PRICE_STATES.quoteRequired,
    builderApprovalRequired: priceState === PRICE_STATES.quoteRequired || colour?.includedStatus === "quote_required",
    clientConfirmationStatus: "confirmed",
    revision: configuration.revision || 1,
  };
  const procurementSchedule = [{
    garageDoorId: garageDoorSelection.projectGarageDoorId,
    location: garageDoorSelection.location,
    quantity,
    openingWidth: garageDoorSelection.openingWidth,
    openingHeight: garageDoorSelection.openingHeight,
    supplier,
    range,
    doorType,
    profile,
    material: garageDoorSelection.material,
    officialColourName: garageDoorSelection.officialColourName,
    supplierColourCode: garageDoorSelection.supplierColourCode,
    finishFamily: garageDoorSelection.finishFamily,
    motorOperator: automation,
    remotes: garageDoorSelection.remotes,
    accessories,
    allowance,
    quotedCost: selectedPrice,
    variation,
    sourceSelectionId: "",
    revision: garageDoorSelection.revision,
    confirmationStatus: "confirmed",
  }];
  const productName = `${supplier} ${range} ${profile} - ${colour?.officialName || "Colour to be confirmed"}`.replace(/\s+/g, " ").trim();
  return {
    ...product,
    productName,
    product_name: productName,
    colour: colour?.officialName || "",
    finish: [colour?.finishFamily, colour?.finishType].filter(Boolean).join(" / "),
    profile,
    size,
    configuration: doorType,
    selectedCost: selectedPrice,
    clientPrice: selectedPrice,
    priceStatus: priceState,
    priceState,
    garageDoorSelection,
    garageDoorSchedule: procurementSchedule,
    procurementSchedule,
    supplierProcurementStatus: priceState === PRICE_STATES.quoteRequired ? "quote_required" : "ready_for_rfq",
    metadata: {
      ...(product.metadata || {}),
      garageDoorSelection,
      garageDoorSchedule: procurementSchedule,
      procurementSchedule,
      supplierProcurementStatus: priceState === PRICE_STATES.quoteRequired ? "quote_required" : "ready_for_rfq",
      productEntity: {
        ...(product.metadata?.productEntity || product),
        productName,
        colour: colour?.officialName || "",
        finish: [colour?.finishFamily, colour?.finishType].filter(Boolean).join(" / "),
        profile,
        size,
        configuration: doorType,
        priceStatus: priceState,
        garageDoorSelection,
        garageDoorSchedule: procurementSchedule,
        procurementSchedule,
        supplierProcurementStatus: priceState === PRICE_STATES.quoteRequired ? "quote_required" : "ready_for_rfq",
      },
    },
  };
}

export function externalLightingCategory(product = {}) {
  return product.attributes?.exteriorCategory || product.metadata?.productEntity?.attributes?.exteriorCategory || product.category || "External Lighting";
}

export function externalLightingSku(product = {}) {
  return product.attributes?.beaconSku || product.metadata?.productEntity?.attributes?.beaconSku || product.productCode || "";
}

export function externalLightingProductMatches(product = {}, filters = {}) {
  const attrs = product.attributes || product.metadata?.productEntity?.attributes || {};
  const term = String(filters.search || "").trim().toLowerCase();
  const haystack = [
    product.productName,
    product.product_name,
    product.productCode,
    product.range,
    attrs.beaconSku,
    attrs.exteriorCategory,
    attrs.installationType,
    attrs.ipRating,
    attrs.voltage,
    attrs.wattage,
  ].filter(Boolean).join(" ").toLowerCase();
  if (term && !haystack.includes(term)) return false;
  if (filters.category && externalLightingCategory(product) !== filters.category) return false;
  if (filters.finish && String(product.finish || product.colour || "").toLowerCase() !== String(filters.finish).toLowerCase()) return false;
  if (filters.installationType && attrs.installationType !== filters.installationType) return false;
  if (filters.sensor === "sensor" && !attrs.sensorIncluded) return false;
  if (filters.sensor === "no-sensor" && attrs.sensorIncluded) return false;
  if (filters.voltage && attrs.voltage !== filters.voltage) return false;
  return true;
}

export function externalLightingWorkflowProduct(product = {}, requirement = {}, configuration = {}) {
  const attrs = product.attributes || product.metadata?.productEntity?.attributes || {};
  const locations = (configuration.locations || []).filter((location) => Number(location.quantity || 0) > 0);
  const quantity = locations.reduce((sum, location) => sum + (numberValue(location.quantity) || 0), 0) || 1;
  const unitCost = productClientPrice(product);
  const selectedPrice = unitCost * quantity;
  const allowance = productAllowance(product, requirement);
  const variation = variationFor({ selectedPrice, allowance, quantity: 1 });
  const sku = externalLightingSku(product);
  const category = externalLightingCategory(product);
  const lightingSchedule = locations.map((location, index) => ({
    lightingPointId: location.lightingPointId || `EL${String(index + 1).padStart(2, "0")}`,
    floor: location.floor || "Ground",
    elevation: location.elevation || "",
    roomOrExteriorArea: location.area || location.location || "",
    exactLocation: location.location || "",
    productName: product.productName || product.product_name || "",
    sku,
    colourFinish: product.finish || product.colour || "",
    quantity: numberValue(location.quantity) || 1,
    switching: location.switching || "By electrical schedule",
    sensorRequirement: attrs.sensorIncluded ? "Sensor included" : (location.sensorRequirement || "No sensor specified"),
    installationType: attrs.installationType || attrs.constructionSuitability || "",
    allowance,
    selectedPrice: unitCost,
    variation: (unitCost - (allowance / Math.max(quantity, 1))) * (numberValue(location.quantity) || 1),
    notes: location.notes || "",
  }));
  const externalLightingSelection = {
    supplier: "Beacon Lighting",
    productName: product.productName || product.product_name || "",
    sku,
    category,
    finish: product.finish || product.colour || "",
    ipRating: attrs.ipRating || "",
    constructionSuitability: attrs.constructionSuitability || "",
    installationType: attrs.installationType || "",
    electricianRequired: Boolean(attrs.electricianRequired),
    voltage: attrs.voltage || "",
    wattage: attrs.wattage || "",
    lumens: attrs.lumens || "",
    colourTemperature: attrs.colourTemperature || "",
    globeType: attrs.globeType || "",
    globeIncluded: attrs.globeIncluded || "",
    integratedLed: Boolean(attrs.integratedLed),
    sensorIncluded: Boolean(attrs.sensorIncluded),
    sensorType: attrs.sensorType || "",
    locationSuitability: attrs.locationSuitability || [],
    exposureLimitations: attrs.exposureLimitations || "",
    poolZoneRestriction: attrs.poolZoneRestriction || "",
    quantity,
    unitCost,
    selectedPrice,
    allowance,
    variation,
    priceVerifiedAt: product.priceVerifiedAt || product.price_verified_at || "",
    saleClearanceStatus: product.saleClearanceStatus || product.sale_clearance_status || "",
    officialProductUrl: product.officialProductURL || product.officialProductUrl || product.official_product_url || "",
    locations: lightingSchedule,
    revision: configuration.revision || 1,
    clientConfirmationStatus: "confirmed",
  };
  const procurementSchedule = [{
    supplier: "Beacon Lighting",
    productName: externalLightingSelection.productName,
    sku,
    category,
    finish: externalLightingSelection.finish,
    ipRating: externalLightingSelection.ipRating,
    quantity,
    unitCost,
    extendedCost: selectedPrice,
    locationReferences: lightingSchedule.map((item) => `${item.lightingPointId}: ${item.exactLocation}`).join("; "),
    installationRequirement: externalLightingSelection.installationType,
    allowance,
    variation,
    selectionId: `external-lighting:${sku || slugValue(externalLightingSelection.productName)}:${configuration.revision || 1}`,
    revision: configuration.revision || 1,
  }];
  return {
    ...product,
    selectedCost: selectedPrice,
    clientPrice: selectedPrice,
    quantity,
    externalLightingSelection,
    lightingSchedule,
    procurementSchedule,
    supplierProcurementStatus: "ready_for_rfq",
    metadata: {
      ...(product.metadata || {}),
      externalLightingSelection,
      lightingSchedule,
      procurementSchedule,
      supplierProcurementStatus: "ready_for_rfq",
      productEntity: {
        ...(product.metadata?.productEntity || product),
        externalLightingSelection,
        lightingSchedule,
        procurementSchedule,
      },
    },
  };
}

export function externalLightingScheduleWorkflowProduct(scheduleLines = [], requirement = {}, configuration = {}) {
  const revision = configuration.revision || 1;
  const projectId = configuration.projectId || "";
  const normalisedLines = scheduleLines.map((line, index) => normaliseExternalLightingScheduleLine(line, requirement, { index, revision, projectId })).filter(Boolean);
  const totalProducts = normalisedLines.length;
  const totalFittings = normalisedLines.reduce((sum, line) => sum + line.quantity, 0);
  const locationsAssigned = normalisedLines.reduce((sum, line) => sum + line.assignedQuantity, 0);
  const missingLocations = normalisedLines.reduce((sum, line) => sum + line.missingLocations, 0);
  const quoteRequiredProducts = normalisedLines.filter((line) => line.priceStatus === PRICE_STATES.quoteRequired || line.priceStatus === PRICE_STATES.pending || line.priceStatus === PRICE_STATES.expired).length;
  const selectedPrice = roundMoney(normalisedLines.reduce((sum, line) => sum + line.productTotal, 0));
  const allowance = productAllowance({}, requirement);
  const variation = variationFor({ selectedPrice, allowance, quantity: 1 });
  const lightingSchedule = normalisedLines.flatMap((line) => line.locations.map((location) => ({
    ...location,
    scheduleLineId: line.scheduleLineId,
    productName: line.productName,
    sku: line.sku,
    category: line.category,
    colourFinish: line.finish,
    ipRating: line.ipRating,
    voltage: line.voltage,
    wattage: line.wattage,
    sensorRequirement: line.sensorIncluded ? (line.sensorType || "Sensor included") : (location.sensorRequirement || "No sensor specified"),
    installationType: line.installationType,
  })));
  const procurementSchedule = normalisedLines.map((line) => ({
    projectId,
    selectionId: `external-lighting:${configuration.selectionId || "pending"}`,
    lightingScheduleLineId: line.scheduleLineId,
    lightingPointIds: line.locations.map((location) => location.lightingPointId).filter(Boolean),
    supplier: "Beacon Lighting",
    brand: line.brand,
    productName: line.productName,
    sku: line.sku,
    category: line.category,
    finish: line.finish,
    ipRating: line.ipRating,
    voltage: line.voltage,
    globeType: line.globeType,
    integratedLed: line.integratedLed,
    sensorIncluded: line.sensorIncluded,
    sensorType: line.sensorType,
    quantity: line.quantity,
    unit: "each",
    unitCost: line.unitCost,
    unitPrice: line.unitCost,
    extendedCost: line.productTotal,
    allowance: line.allowance,
    variation: line.variation,
    locationReferences: line.locations.map((item) => `${item.lightingPointId}: ${item.exactLocation}`).join("; "),
    installationRequirement: line.installationType,
    revision,
    status: line.priceStatus === PRICE_STATES.current ? "ready_for_rfq" : "quote_required",
  }));
  const electricalContractorSchedule = lightingSchedule.map((row) => ({
    lightingPointId: row.lightingPointId,
    location: row.exactLocation,
    productName: row.productName,
    sku: row.sku,
    quantity: row.quantity,
    mountingType: row.category,
    voltage: row.voltage,
    wattage: row.wattage,
    sensor: row.sensorRequirement,
    switching: row.switching,
    ipRating: row.ipRating,
    installationNotes: row.notes,
  }));
  const categoryCounts = normalisedLines.reduce((counts, line) => {
    const category = line.category || "External Lighting";
    counts[category] = (counts[category] || 0) + line.quantity;
    return counts;
  }, {});
  const dashboardSummary = [
    `${totalFittings} fitting${totalFittings === 1 ? "" : "s"} selected`,
    ...Object.entries(categoryCounts).slice(0, 3).map(([category, quantity]) => `${quantity} ${category.toLowerCase()}`),
  ].join(" / ");
  const summary = {
    totalProducts,
    totalFittings,
    locationsAssigned,
    missingLocations,
    quoteRequiredProducts,
    selectedPrice,
    allowance,
    variation,
    complete: totalProducts > 0 && totalFittings > 0 && missingLocations === 0,
  };
  const externalLightingSelection = {
    supplier: "Beacon Lighting",
    isSchedule: true,
    scheduleLines: normalisedLines,
    summary,
    dashboardSummary,
    quantity: totalFittings,
    selectedPrice,
    allowance,
    variation,
    locations: lightingSchedule,
    missingLocations,
    quoteRequiredProducts,
    revision,
    clientConfirmationStatus: summary.complete ? "confirmed" : "in_progress",
  };
  return {
    id: "external-lighting-schedule",
    productId: "external-lighting-schedule",
    productCode: "EXTERNAL-LIGHTING-SCHEDULE",
    familyKey: "external-lighting",
    category: "External Lighting",
    supplier: "Beacon Lighting",
    brand: "Beacon Lighting",
    productName: "External Lighting Schedule",
    description: dashboardSummary,
    finish: `${totalProducts} product${totalProducts === 1 ? "" : "s"} / ${totalFittings} fitting${totalFittings === 1 ? "" : "s"}`,
    primaryImage: configuration.dashboardImage || "",
    selectedCost: selectedPrice,
    clientPrice: selectedPrice,
    quantity: 1,
    priceStatus: quoteRequiredProducts ? PRICE_STATES.quoteRequired : PRICE_STATES.current,
    externalLightingSelection,
    lightingSchedule,
    electricalContractorSchedule,
    procurementSchedule,
    supplierProcurementStatus: quoteRequiredProducts ? "quote_required" : "ready_for_rfq",
    metadata: {
      externalLightingSelection,
      lightingSchedule,
      electricalContractorSchedule,
      procurementSchedule,
      supplierProcurementStatus: quoteRequiredProducts ? "quote_required" : "ready_for_rfq",
      productEntity: {
        productName: "External Lighting Schedule",
        supplier: "Beacon Lighting",
        brand: "Beacon Lighting",
        familyKey: "external-lighting",
        description: dashboardSummary,
        finish: `${totalProducts} product${totalProducts === 1 ? "" : "s"} / ${totalFittings} fitting${totalFittings === 1 ? "" : "s"}`,
        primaryImage: configuration.dashboardImage || "",
        clientPrice: selectedPrice,
        priceStatus: quoteRequiredProducts ? PRICE_STATES.quoteRequired : PRICE_STATES.current,
        externalLightingSelection,
        lightingSchedule,
        electricalContractorSchedule,
        procurementSchedule,
      },
    },
  };
}

export function exteriorColourScheduleWorkflowProduct(areaRows = [], requirement = {}, configuration = {}) {
  const revision = configuration.revision || new Date().toISOString();
  const projectId = configuration.projectId || "";
  const normalisedAreas = areaRows.map((area, index) => normaliseExteriorColourArea(area, { index, revision, projectId })).filter(Boolean);
  const applicableAreas = normalisedAreas.filter((area) => area.applicable !== false);
  const selectedAreas = applicableAreas.filter((area) => exteriorColourAreaComplete(area));
  const uniqueColours = new Set(applicableAreas
    .filter((area) => area.colourSelection?.colourName)
    .map((area) => `${area.colourSelection.supplier}|${area.colourSelection.colourName}|${area.colourSelection.colourCode}`)).size;
  const summary = {
    totalAreas: normalisedAreas.length,
    applicableAreas: applicableAreas.length,
    selectedAreas: selectedAreas.length,
    incompleteAreas: Math.max(0, applicableAreas.length - selectedAreas.length),
    uniqueColours,
    complete: applicableAreas.length > 0 && selectedAreas.length === applicableAreas.length,
  };
  const confirmed = Boolean(configuration.confirmed) || configuration.status === "confirmed";
  const components = applicableAreas.map((area) => ({
    componentId: area.componentId,
    componentType: area.componentType,
    areaName: area.areaName,
    material: area.material,
    supplier: area.colourSelection?.supplier || "",
    productRange: area.colourSelection?.range || "",
    colourId: area.colourSelection?.colourId || "",
    colourName: area.colourSelection?.colourName || "",
    colourCode: area.colourSelection?.colourCode || "",
    swatch: area.colourSelection?.swatch || "",
    colourSource: area.colourSource,
    linkedComponentId: area.linkedComponentId || "",
    isOverride: Boolean(area.isOverride),
    compatibilityStatus: area.compatibilityStatus || "compatible",
    confirmationStatus: confirmed && exteriorColourAreaComplete(area) ? "confirmed" : area.confirmationStatus,
    revision: area.revision || revision,
  }));
  const clientColourSchedule = applicableAreas.map((area) => ({
    componentId: area.componentId,
    componentType: area.componentType,
    areaId: area.areaId,
    areaName: area.areaName,
    areaGroup: area.areaGroup,
    material: area.material,
    supplier: area.colourSelection?.supplier || "",
    range: area.colourSelection?.range || "",
    productRange: area.colourSelection?.range || "",
    colourId: area.colourSelection?.colourId || "",
    colourName: area.colourSelection?.colourName || "",
    colourCode: area.colourSelection?.colourCode || "",
    swatch: area.colourSelection?.swatch || "",
    colourSource: area.colourSource,
    linkedComponentId: area.linkedComponentId || "",
    isOverride: Boolean(area.isOverride),
    compatibilityStatus: area.compatibilityStatus || "compatible",
    finishType: area.finishType,
    status: exteriorColourAreaStatus(area, { scheduleConfirmed: confirmed }),
    confirmationStatus: confirmed && exteriorColourAreaComplete(area) ? "confirmed" : area.confirmationStatus,
    notes: area.notes || "",
    revision: area.revision || revision,
  }));
  const painterTradeSchedule = applicableAreas.map((area) => ({
    areaId: area.areaId,
    areaName: area.areaName,
    substrate: area.material,
    approximateMeasuredArea: area.measuredArea || null,
    preparation: area.coatingSpecification?.preparation || "Prepare substrate to builder and manufacturer requirements",
    primer: area.coatingSpecification?.primer || "Painter to confirm primer/sealer to substrate",
    technicalPaintProduct: area.coatingSpecification?.topcoat || "",
    sheen: area.coatingSpecification?.sheen || "",
    coats: area.coatingSpecification?.coats || "Builder/painter specification",
    colourName: area.colourSelection?.colourName || "",
    colourCode: area.colourSelection?.colourCode || "",
    notes: area.notes || "",
  }));
  const dashboardSummary = `${summary.selectedAreas}/${summary.applicableAreas} exterior colour areas selected`;
  const exteriorColourSelection = {
    isSchedule: true,
    canonical: true,
    scheduleId: configuration.scheduleId || `exterior-colours-${projectId || "project"}`,
    status: confirmed && summary.complete ? "confirmed" : "in_progress",
    areas: normalisedAreas,
    components,
    masterColourSchedule: components,
    summary,
    clientColourSchedule,
    painterTradeSchedule,
    technicalCoatingRecords: painterTradeSchedule,
    dashboardSummary,
    updatedAt: revision,
    confirmedAt: confirmed && summary.complete ? (configuration.confirmedAt || revision) : "",
    revision,
  };
  return {
    id: "exterior-colour-schedule",
    productId: "exterior-colour-schedule",
    productCode: "EXTERIOR-COLOUR-SCHEDULE",
    familyKey: "exterior-paint",
    category: "Exterior Colours",
    supplier: "Builder/client nominated suppliers",
    brand: "Project colour schedule",
    productName: "Exterior Colour Schedule",
    description: `${summary.applicableAreas} applicable exterior areas, ${summary.selectedAreas} completed, ${summary.incompleteAreas} incomplete.`,
    finish: `${summary.uniqueColours} unique colours`,
    primaryImage: configuration.dashboardImage || "",
    imageUrl: configuration.dashboardImage || "",
    selectedCost: 0,
    clientPrice: 0,
    quantity: 1,
    priceStatus: PRICE_STATES.allowanceOnly,
    exteriorColourSelection,
    masterColourSchedule: components,
    clientColourSchedule,
    painterTradeSchedule,
    technicalCoatingRecords: painterTradeSchedule,
    supplierProcurementStatus: summary.complete ? "ready_for_rfq" : "draft",
    metadata: {
      exteriorColourSelection,
      masterColourSchedule: components,
      clientColourSchedule,
      painterTradeSchedule,
      technicalCoatingRecords: painterTradeSchedule,
      productEntity: {
        productName: "Exterior Colour Schedule",
        supplier: "Builder/client nominated suppliers",
        brand: "Project colour schedule",
        familyKey: "exterior-paint",
        description: dashboardSummary,
        finish: `${summary.uniqueColours} unique colours`,
        primaryImage: configuration.dashboardImage || "",
        clientPrice: 0,
        priceStatus: PRICE_STATES.allowanceOnly,
        exteriorColourSelection,
        clientColourSchedule,
        painterTradeSchedule,
      },
    },
  };
}

function normaliseExternalLightingScheduleLine(line = {}, requirement = {}, { index = 0, revision = 1, projectId = "" } = {}) {
  const product = line.product || line;
  const attrs = product.attributes || product.metadata?.productEntity?.attributes || line.attributes || {};
  const quantity = Math.max(1, Math.trunc(numberValue(line.quantity) || 1));
  const unitCost = numberValue(line.unitCost ?? line.unitPrice ?? productClientPrice(product));
  const productTotal = roundMoney(unitCost * quantity);
  const allowance = roundMoney(numberValue(line.allowance) || 0);
  const sku = line.sku || externalLightingSku(product);
  const scheduleLineId = line.scheduleLineId || `els-${slugValue([sku, product.finish || product.colour || line.finish, index + 1].filter(Boolean).join("-"))}`;
  const rawLocations = Array.isArray(line.locations) ? line.locations : [];
  const locations = rawLocations.map((location, locationIndex) => ({
    lightingPointId: location.lightingPointId || `EL${String(locationIndex + 1).padStart(2, "0")}`,
    floor: location.floor || "Ground",
    elevation: location.elevation || "",
    roomOrExteriorArea: location.area || location.location || location.exactLocation || "",
    exactLocation: location.exactLocation || [location.location, location.notes].filter(Boolean).join(", ") || "",
    quantity: Math.max(1, Math.trunc(numberValue(location.quantity) || 1)),
    switching: location.switching || "By electrical schedule",
    sensorRequirement: location.sensorRequirement || "",
    notes: location.notes || "",
  }));
  const assignedQuantity = locations.reduce((sum, location) => sum + location.quantity, 0);
  const missingLocations = Math.max(0, quantity - assignedQuantity);
  return {
    projectId,
    scheduleLineId,
    productId: product.productId || product.id || line.productId || "",
    productCode: product.productCode || line.productCode || "",
    productName: product.productName || product.product_name || line.productName || "",
    supplier: "Beacon Lighting",
    brand: product.brand || line.brand || "Beacon Lighting",
    sku,
    category: line.category || externalLightingCategory(product),
    finish: line.finish || product.finish || product.colour || "",
    imageUrl: line.imageUrl || resolveProductLibraryImage({ product }) || "",
    officialProductUrl: product.officialProductURL || product.officialProductUrl || product.official_product_url || line.officialProductUrl || "",
    ipRating: attrs.ipRating || line.ipRating || "",
    voltage: attrs.voltage || line.voltage || "",
    wattage: attrs.wattage || line.wattage || "",
    globeType: attrs.globeType || line.globeType || "",
    integratedLed: Boolean(attrs.integratedLed ?? line.integratedLed),
    sensorIncluded: Boolean(attrs.sensorIncluded ?? line.sensorIncluded),
    sensorType: attrs.sensorType || line.sensorType || "",
    installationType: attrs.installationType || attrs.constructionSuitability || line.installationType || "",
    quantity,
    assignedQuantity,
    missingLocations,
    unitCost,
    productTotal,
    allowance,
    variation: roundMoney(productTotal - allowance),
    priceStatus: product.priceStatus || line.priceStatus || (unitCost > 0 ? PRICE_STATES.current : PRICE_STATES.quoteRequired),
    includedStatus: attrs.includedStatus || line.includedStatus || (productTotal <= allowance ? "included" : "upgrade"),
    locations,
    notes: line.notes || "",
    revision,
  };
}

export function normaliseExteriorColourArea(area = {}, { index = 0, revision = new Date().toISOString(), projectId = "" } = {}) {
  const base = EXTERIOR_COLOUR_AREAS.find((item) => item.areaId === area.areaId) || EXTERIOR_COLOUR_AREAS[index] || EXTERIOR_COLOUR_AREAS[0];
  const finishType = area.finishType || base?.finishType || "painted";
  const colourSelection = normaliseExteriorColourSelection(area.colourSelection || area.colour || null);
  const coatingSpecification = area.coatingSpecification || technicalCoatingForExteriorArea({ ...base, ...area, finishType });
  const areaId = area.areaId || base.areaId || `custom-area-${index + 1}`;
  const colourSource = area.colourSource || sourceToColourSource(area.source || base.source);
  const existingComponentId = area.componentId || "";
  const componentId = projectId && (!existingComponentId || existingComponentId.startsWith("project:"))
    ? `${projectId}:${areaId}`
    : existingComponentId || `${projectId || "project"}:${areaId}`;
  return {
    areaId,
    componentId,
    componentType: area.componentType || componentTypeForExteriorArea({ ...base, ...area, areaId }),
    projectId,
    areaName: area.areaName || base.areaName || `Exterior area ${index + 1}`,
    areaGroup: area.areaGroup || base.areaGroup || "Other items",
    material: area.material || base.material || "Exterior surface",
    source: area.source || base.source || "Builder-added area",
    applicable: area.applicable !== false,
    colourSelection,
    colourSource,
    linkedComponentId: area.linkedComponentId || "",
    isOverride: Boolean(area.isOverride || area.defaultStatus === "override" || colourSource === "client-override"),
    compatibilityStatus: area.compatibilityStatus || "compatible",
    coatingSpecification,
    finishType,
    defaultStatus: area.defaultStatus || (["selected", "applied"].includes(colourSelection?.status) ? "override" : "default"),
    notes: area.notes || "",
    measuredArea: area.measuredArea || null,
    confirmationStatus: area.confirmationStatus || inferExteriorColourAreaStatus({ colourSelection, finishType }),
    lockedByMaterialSelection: Boolean(area.lockedByMaterialSelection || finishType === "factory_finished"),
    updatedAt: area.updatedAt || revision,
    revision: area.revision || revision,
  };
}

export function exteriorColourAreaComplete(area = {}) {
  return ["selected", "applied", "not_painted", "factory_finished", "confirm_with_note"].includes(area.confirmationStatus)
    || Boolean(area.colourSelection?.colourName && ["selected", "applied"].includes(area.colourSelection?.status));
}

export function exteriorColourAreaStatus(area = {}, { scheduleConfirmed = false } = {}) {
  if (scheduleConfirmed && exteriorColourAreaComplete(area)) return "confirmed";
  if (area.compatibilityStatus && area.compatibilityStatus !== "compatible") return "incompatible_selection";
  if (area.colourSelection?.status === "quote_required" || area.confirmationStatus === "quote_required") return "quote_required";
  if (area.finishType === "not_painted" || area.confirmationStatus === "not_painted") return "not_painted";
  if (area.finishType === "factory_finished" && !area.colourSelection?.colourName) return "material_finish";
  if (area.colourSelection?.colourName && !area.isOverride) {
    if (area.colourSource === "roofing-selection") return "linked_roofing";
    if (area.colourSource === "window-selection") return "linked_windows";
    if (area.colourSource === "garage-door-selection") return "linked_garage_door";
    if (area.colourSource === "cladding-selection") return "linked_cladding";
  }
  if (area.confirmationStatus === "confirm_with_note") return "needs_client_confirmation";
  if (area.colourSelection?.colourName) return "colour_selected";
  if (area.applicable === false) return "not_selected";
  return area.defaultApplicable === false ? "not_selected" : "selection_required";
}

function normaliseExteriorColourSelection(selection = null) {
  if (!selection) return null;
  return {
    colourId: selection.colourId || selection.id || "",
    supplier: selection.supplier || "",
    range: selection.range || "",
    colourName: selection.colourName || selection.name || "",
    colourCode: selection.colourCode || selection.code || "",
    colourFamily: selection.colourFamily || selection.family || "",
    colourFamilies: Array.isArray(selection.colourFamilies) ? selection.colourFamilies : [selection.colourFamily || selection.family].filter(Boolean),
    paletteSources: Array.isArray(selection.paletteSources) ? selection.paletteSources : [],
    searchTerms: Array.isArray(selection.searchTerms) ? selection.searchTerms : [],
    lrv: selection.lrv ?? null,
    suitability: selection.suitability || "",
    swatch: selection.swatch || selection.hex || "",
    officialSource: selection.officialSource || selection.sourceUrl || selection.source || "",
    verifiedDate: selection.verifiedDate || "",
    applicationMethod: selection.applicationMethod || "",
    status: selection.status || "selected",
  };
}

export function exteriorColourMatchesFamily(colour = {}, family = "") {
  if (!family) return true;
  const families = Array.isArray(colour.colourFamilies) && colour.colourFamilies.length ? colour.colourFamilies : [colour.colourFamily].filter(Boolean);
  return families.some((item) => item === family);
}

export function exteriorColourSearchText(colour = {}) {
  return [
    colour.colourId,
    colour.supplier,
    colour.range,
    colour.colourName,
    colour.colourCode,
    colour.colourFamily,
    ...(Array.isArray(colour.colourFamilies) ? colour.colourFamilies : []),
    ...(Array.isArray(colour.searchTerms) ? colour.searchTerms : []),
    ...(Array.isArray(colour.paletteSources) ? colour.paletteSources : []),
  ].filter(Boolean).join(" ").toLowerCase();
}

export function exteriorColourPopularGroups(colours = []) {
  return [
    {
      id: "builder-standard",
      label: "Builder's standard colours",
      source: "Configured from builder standard palette",
      colours: colours.filter((colour) => colour.paletteSources?.includes("builder-standard")),
    },
    {
      id: "supplier-popular",
      label: "Supplier popular exterior colours",
      source: "Supplier popular shortcut from catalogue metadata",
      colours: colours.filter((colour) => colour.paletteSources?.includes("supplier-popular")),
    },
  ].filter((group) => group.colours.length);
}

function inferExteriorColourAreaStatus({ colourSelection, finishType } = {}) {
  if (finishType === "not_painted") return "not_painted";
  if (finishType === "factory_finished" && colourSelection?.colourName) return "factory_finished";
  if (colourSelection?.colourName) return "selected";
  return "incomplete";
}

function technicalCoatingForExteriorArea(area = {}) {
  const finishType = area.finishType || "painted";
  if (finishType === "factory_finished") {
    return {
      primer: "Factory finish - not site painted",
      topcoat: "Manufacturer factory-finished colour",
      sheen: "Manufacturer finish",
      coats: "Factory applied",
      technicalSource: "Linked material manufacturer colour",
    };
  }
  if (finishType === "stained") {
    return {
      preparation: "Sand and prepare timber to painter/supplier instructions",
      primer: "Timber prep/sealer to painter specification",
      topcoat: "Exterior timber stain/clear finish to painter specification",
      sheen: "Supplier finish system",
      coats: "Painter specification",
      technicalSource: "Builder/painter timber finish schedule",
    };
  }
  const material = String(`${area.material || ""} ${area.areaName || ""}`).toLowerCase();
  const trim = /trim|surround|fascia|door|timber|post|beam|handrail|balustrade/.test(material);
  return {
    preparation: "Prepare substrate to builder and manufacturer requirements",
    primer: material.includes("render") ? "Render sealer/primer to painter specification" : "Primer/sealer to painter specification",
    topcoat: trim ? "Dulux Weathershield Semi Gloss or builder-approved equivalent" : "Dulux Weathershield Low Sheen or builder-approved equivalent",
    sheen: trim ? "Semi Gloss" : "Low Sheen",
    coats: "Two finish coats unless painter/manufacturer requires otherwise",
    technicalSource: "Builder/painter coating specification; client selects colour only",
  };
}

function exteriorColourArea(areaId, areaName, areaGroup, material, finishType, source, defaultApplicable = false, colourSource = "") {
  return {
    areaId,
    areaName,
    areaGroup,
    material,
    finishType,
    source,
    defaultApplicable,
    componentType: componentTypeForExteriorArea({ areaId, areaGroup, material }),
    colourSource: colourSource || sourceToColourSource(source),
  };
}

function exteriorColour(colourId, supplier, range, colourName, colourCode, colourFamily, swatch, lrv, suitability, officialSource, status = "standard", colourFamilies = [], paletteSources = []) {
  const families = Array.from(new Set([colourFamily, ...colourFamilies].filter(Boolean)));
  return {
    colourId,
    supplier,
    range,
    colourName,
    colourCode,
    colourFamily,
    colourFamilies: families,
    paletteSources,
    searchTerms: [colourName, colourCode, supplier, range, ...families].filter(Boolean),
    swatch,
    lrv,
    suitability,
    officialSource,
    verifiedDate: "2026-08-27",
    status,
  };
}

function componentTypeForExteriorArea(area = {}) {
  const text = `${area.areaId || ""} ${area.areaGroup || ""} ${area.material || ""}`.toLowerCase();
  if (/roof|fascia|gutter|downpipe|eave|soffit|ceiling/.test(text)) return "roofline";
  if (/window/.test(text)) return "windows";
  if (/garage/.test(text)) return "garage-door";
  if (/cladding/.test(text)) return "cladding";
  if (/timber|post|beam|batten|screen|handrail|balustrade/.test(text)) return "timber-feature";
  return "exterior-colour-area";
}

function sourceToColourSource(source = "") {
  const text = String(source || "").toLowerCase();
  if (text.includes("roofing")) return "roofing-selection";
  if (text.includes("window")) return "window-selection";
  if (text.includes("garage")) return "garage-door-selection";
  if (text.includes("cladding")) return "cladding-selection";
  if (text.includes("builder")) return "builder-default";
  return "exterior-colour-schedule";
}

export function garageDoorSupplierId(product = {}) {
  const supplier = garageDoorSupplierName(product).toLowerCase();
  if (/b&d|bnd/.test(supplier)) return "bnd";
  if (/steel-line|steelline/.test(supplier)) return "steel-line";
  if (/gliderol/.test(supplier)) return "gliderol";
  if (/centurion|cgdoors/.test(supplier)) return "centurion";
  return slugValue(supplier || "unknown");
}

export function garageDoorSupplierName(product = {}) {
  const entity = product?.metadata?.productEntity || product || {};
  return entity.supplier || entity.manufacturer || product.supplier || product.manufacturer || "";
}

export function garageDoorDoorType(product = {}) {
  const attrs = garageDoorAttributes(product);
  return attrs.doorType || (/roller/i.test(`${product.range} ${product.model} ${product.configuration}`) ? "Roller" : /designer/i.test(`${product.range} ${product.model} ${product.configuration}`) ? "Designer/profile range" : "Sectional");
}

function garageDoorAttributes(product = {}) {
  const entity = product?.metadata?.productEntity || product || {};
  return entity.attributes || product.attributes || {};
}

export function filtersForRequirement(requirement, products = []) {
  const keys = filterKeys(requirement);
  return keys.map((key) => ({
    key,
    label: titleLabel(key),
    values: Array.from(new Set(products.map((product) => productValue(product, key)).filter(Boolean))).sort(),
  })).filter((filter) => filter.values.length > 1);
}

function productValue(product, key) {
  const entity = product.metadata?.productEntity || product;
  return entity[key] || product[key] || product.metadata?.[key] || "";
}

function firstField(source = {}, fields = []) {
  return fields.map((field) => source?.[field]).find(Boolean) || "";
}

function placeholderSelectionImage(label) {
  const safeLabel = String(label || "Selection").replace(/[<>&"]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600"><rect width="900" height="600" fill="#e8edf3"/><rect x="48" y="48" width="804" height="504" rx="18" fill="#f8fafc" stroke="#cbd5e1"/><path d="M120 410h660l-190-178-130 112-88-76z" fill="#cbd5e1"/><circle cx="252" cy="208" r="58" fill="#d7dee8"/><text x="450" y="508" text-anchor="middle" font-family="Arial" font-size="32" font-weight="800" fill="#172033">${safeLabel}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function filterKeys(requirement) {
  if (requirement.familyKey === "ovens") return ["brand", "width", "fuelType", "finish"];
  if (requirement.familyKey === "stone-benchtops") return ["supplier", "range", "colour"];
  if (["kitchen-sinks", "kitchen-sink-mixers"].includes(requirement.familyKey)) return ["supplier", "brand", "range", "finish"];
  if (requirement.familyKey === "cooktops") return ["brand", "width", "fuelType", "finish"];
  return ["supplier", "brand", "range", "colour", "finish"];
}

function requirement(requirementKey, label, familyKey, defaultAllowance, unit = "EACH", defaultQuantity = 1, areaKey = KITCHEN_AREA_KEY, areaLabel = KITCHEN_AREA_LABEL, imageKey = familyKey, options = {}) {
  return {
    areaKey,
    areaLabel,
    requirementKey,
    label,
    familyKey,
    defaultAllowance,
    unit,
    defaultQuantity,
    imageKey,
    optionalWhenProjectMissing: Boolean(options.optionalWhenProjectMissing),
    projectAliases: Array.isArray(options.projectAliases) ? options.projectAliases : [],
  };
}

function titleLabel(value) {
  return String(value || "").replace(/([A-Z])/g, " $1").replace(/\b\w/g, (letter) => letter.toUpperCase()).trim();
}

function slugValue(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
