import { exteriorSectionForProduct, isExternalDoorHardware, EXTERIOR_CATALOGUE_SECTIONS, ENTRANCE_HARDWARE_IMAGE } from "./exteriorCatalogueSections.js";
import {
  PRODUCT_FAMILIES,
  resolveProductLibraryImage,
} from "./catalogueModel.js";
import {
  PRODUCT_LIBRARY_CABINETRY_CATEGORY_ASSETS,
} from "./cabinetryCatalogueSelectors.js";

export const PRODUCT_LIBRARY_ROOM_ASSETS = {
  kitchen: asset("/images/catalogues/product-library/rooms/kitchen-cabinetry-appliances.jpg", "https://unsplash.com/photos/bff31c812dba", "Unsplash kitchen cabinetry/appliance image, stored locally for Product Library room browsing."),
  "butlers-pantry": asset("/images/catalogues/product-library/rooms/butlers-pantry-cabinetry-shelving.jpg", "https://www.gjgardner.com.au/learn/design-and-inspiration/butlers-pantry-vs-walk-in-pantr/", "G.J. Gardner Homes butler's pantry image, stored locally for Product Library room browsing."),
  bathroom: asset("/images/catalogues/product-library/rooms/bathroom-vanity-basin-mirror.jpg", "https://unsplash.com/photos/996317b8d101", "Unsplash bathroom vanity, basin and bath image, stored locally for Product Library room browsing."),
  ensuite: asset("/images/catalogues/product-library/rooms/ensuite-shower-vanity.jpg", "https://www.dreamridgehomes.com/marda-loop-available", "Dream Ridge Homes ensuite bathroom image, stored locally for Product Library room browsing."),
  "powder-room": asset("/images/catalogues/product-library/rooms/powder-room-vanity-mirror.jpg", "https://www.houzz.com/photos/modern-powder-room-ideas-phbr1-bp~t_713~s_2105", "Houzz powder room vanity/mirror image, stored locally for Product Library room browsing."),
  laundry: asset("/images/catalogues/product-library/rooms/laundry-cabinetry-appliances.jpg", "https://washtower.co.uk/en_GB/blog/side-by-side-washing-machine-and-dryer/", "Washtower laundry cabinetry/appliances image, stored locally for Product Library room browsing."),
  "living-areas": asset("/images/catalogues/product-library/rooms/living-lounge-room.jpg", "https://unsplash.com/photos/dd6b41faaea6", "Unsplash living/lounge room image, stored locally for Product Library room browsing."),
  bedrooms: asset("/images/catalogues/product-library/rooms/bedroom-wardrobe-interior.jpg", "https://unsplash.com/photos/A4Kf_chf5dU", "Unsplash bedroom image, stored locally for Product Library room browsing."),
  "internal-areas": asset("/images/catalogues/product-library/rooms/internal-hallway-interior.jpg", "https://brunch.co.kr/@kairos-el/8", "Interior hallway image, stored locally for Product Library room browsing."),
  exterior: asset("/images/catalogues/product-library/rooms/exterior-house-facade.jpg", "https://unsplash.com/photos/a5bfcd646154", "Unsplash house exterior image, stored locally for Product Library room browsing."),
  garage: asset("/images/catalogues/product-library/rooms/garage-door-interior.jpg", "https://unsplash.com/photos/g56E31TXwsk", "Unsplash garage/workshop image, stored locally for Product Library room browsing."),
  "alfresco-outdoor": asset("/images/catalogues/product-library/rooms/alfresco-outdoor-entertaining.jpg", "https://www.henley.com.au/home-builder-guide/celebrate-the-outdoors-with-an-alfresco", "Henley Homes alfresco entertaining image, stored locally for Product Library room browsing."),
};

export const PRODUCT_LIBRARY_ROOMS = [
  room("kitchen", "Kitchen", "Kitchen appliances, sinks, mixers, cabinetry, surfaces and finishes.", PRODUCT_LIBRARY_ROOM_ASSETS.kitchen, 10),
  room("butlers-pantry", "Butler's Pantry", "Secondary kitchen and scullery product selections.", PRODUCT_LIBRARY_ROOM_ASSETS["butlers-pantry"], 20),
  room("bathroom", "Bathroom", "Bathroom fixtures, fittings, cabinetry, tiles and finishes.", PRODUCT_LIBRARY_ROOM_ASSETS.bathroom, 30),
  room("ensuite", "Ensuite", "Ensuite fixtures, tapware, vanities, tiles and accessories.", PRODUCT_LIBRARY_ROOM_ASSETS.ensuite, 40),
  room("powder-room", "Powder Room", "Compact wet-area fixtures, mirrors, tapware and accessories.", PRODUCT_LIBRARY_ROOM_ASSETS["powder-room"], 50),
  room("laundry", "Laundry", "Laundry tubs, tapware, appliances, cabinetry and finishes.", PRODUCT_LIBRARY_ROOM_ASSETS.laundry, 60),
  room("living-areas", "Living Areas", "Flooring, paint, lighting and selected interior products.", PRODUCT_LIBRARY_ROOM_ASSETS["living-areas"], 70),
  room("bedrooms", "Bedrooms", "Bedroom flooring, paint, wardrobes, doors and lighting.", PRODUCT_LIBRARY_ROOM_ASSETS.bedrooms, 80),
  room("internal-areas", "Internal Areas", "Internal doors, door furniture, trims, shelving, flooring and paint.", PRODUCT_LIBRARY_ROOM_ASSETS["internal-areas"], 90),
  room("exterior", "Exterior", "Roofing, cladding, bricks, windows, doors and exterior finishes.", PRODUCT_LIBRARY_ROOM_ASSETS.exterior, 100),
  room("garage", "Garage", "Garage doors, access doors, motors, floor finishes and lighting.", PRODUCT_LIBRARY_ROOM_ASSETS.garage, 110),
  room("alfresco-outdoor", "Alfresco & Outdoor", "Decking, balustrades, outdoor lighting, paving and landscape products.", PRODUCT_LIBRARY_ROOM_ASSETS["alfresco-outdoor"], 120),
];

let roomCategoryDisplayOrder = 0;

export const PRODUCT_LIBRARY_ROOM_CATEGORIES = [
  category("cabinetry-products", "Cabinetry Products", "Cabinetry", ["kitchen", "butlers-pantry", "bathroom", "ensuite", "powder-room", "laundry", "bedrooms", "living-areas", "internal-areas"], ["cabinetry"], PRODUCT_LIBRARY_CABINETRY_CATEGORY_ASSETS["cabinet-doors-panels"], filters(["brand", "range", "price"])),
  category("kitchen-appliance-packages", "Appliance Packages", "Kitchen", ["kitchen", "butlers-pantry"], ["appliance-packs"], "/images/catalogues/appliances/fallbacks/appliance-pack.svg", filters(["brand", "size", "fuel", "price", "active"])),
  category("kitchen-ovens", "Ovens", "Kitchen", ["kitchen", "butlers-pantry"], ["ovens"], "/images/catalogues/appliances/fallbacks/oven.svg", filters(["brand", "width", "capacity", "fuel", "finish", "price", "missingImage"])),
  category("kitchen-cooktops", "Cooktops", "Kitchen", ["kitchen", "butlers-pantry"], ["cooktops"], "/images/catalogues/appliances/fallbacks/cooktop.svg", filters(["brand", "width", "gas", "ceramic", "induction", "zones", "finish", "price"])),
  category("kitchen-rangehoods", "Rangehoods", "Kitchen", ["kitchen", "butlers-pantry"], ["rangehoods"], "/images/catalogues/appliances/fallbacks/rangehood.svg", filters(["brand", "width", "canopy", "slideOut", "fixed", "undermount", "finish", "price"])),
  category("kitchen-dishwashers", "Dishwashers", "Kitchen", ["kitchen", "butlers-pantry", "laundry"], ["dishwashers"], "/images/catalogues/appliances/fallbacks/dishwasher.svg", filters(["brand", "width", "finish", "price", "missingImage"])),
  category("kitchen-freestanding-cookers", "Freestanding Cookers", "Kitchen", ["kitchen"], ["freestanding-cookers"], "/images/catalogues/appliances/fallbacks/freestanding-cooker.svg", filters(["brand", "width", "gas", "electric", "finish", "price"])),
  category("kitchen-microwaves", "Microwaves", "Kitchen", ["kitchen", "butlers-pantry"], ["microwaves"], "/images/catalogues/appliances/fallbacks/generic.svg", filters(["brand", "width", "finish", "price"])),
  category("kitchen-refrigeration", "Refrigeration", "Kitchen", ["kitchen", "butlers-pantry"], ["fridges"], resolveProductLibraryImage({ familyKey: "fridges" }), filters(["brand", "width", "capacity", "finish", "price"])),
  category("kitchen-sinks", "Kitchen Sinks", "Kitchen", ["kitchen", "butlers-pantry", "laundry"], ["kitchen-sinks"], resolveProductLibraryImage({ familyKey: "kitchen-sinks" }), filters(["brand", "material", "colour", "mounting", "width", "bowl", "price"])),
  category("kitchen-mixers", "Kitchen Mixers", "Kitchen", ["kitchen", "butlers-pantry", "laundry"], ["kitchen-sink-mixers", "tapware"], resolveProductLibraryImage({ familyKey: "kitchen-sink-mixers" }), filters(["brand", "type", "finish", "wels", "range", "price"])),
  category("cabinetry", "Cabinetry", "Cabinetry", ["kitchen", "butlers-pantry", "bathroom", "ensuite", "powder-room", "laundry"], ["cabinetry"], resolveProductLibraryImage({ familyKey: "cabinetry" }), filters(["brand", "range", "finish", "price"])),
  category("cabinet-doors-panels", "Cabinet Doors & Panels", "Cabinetry", ["kitchen", "butlers-pantry", "bathroom", "ensuite", "powder-room", "laundry"], ["cabinet-finish"], PRODUCT_LIBRARY_CABINETRY_CATEGORY_ASSETS["cabinet-doors-panels"], filters(["brand", "range", "colour", "finish", "missingImage"])),
  category("cabinet-handles", "Cabinet Handles", "Cabinetry", ["kitchen", "butlers-pantry", "bathroom", "ensuite", "powder-room", "laundry"], ["handles"], PRODUCT_LIBRARY_CABINETRY_CATEGORY_ASSETS["cabinet-handles"], filters(["brand", "range", "finish", "size", "price"])),
  category("cabinet-hardware", "Cabinet Hardware", "Cabinetry", ["kitchen", "butlers-pantry", "bathroom", "ensuite", "powder-room", "laundry"], ["cabinetry"], PRODUCT_LIBRARY_CABINETRY_CATEGORY_ASSETS["cabinet-handles"], filters(["brand", "range", "finish", "price"])),
  category("benchtops", "Benchtops", "Surfaces", ["kitchen", "butlers-pantry", "bathroom", "ensuite", "powder-room", "laundry"], ["stone-benchtops", "stone-20mm-tops", "stone-40mm-tops"], resolveProductLibraryImage({ familyKey: "stone-benchtops" }), filters(["brand", "range", "colour", "finish", "price"])),
  category("splashbacks", "Splashbacks", "Surfaces", ["kitchen", "butlers-pantry", "laundry"], ["splashback"], resolveProductLibraryImage({ familyKey: "splashback" }), filters(["brand", "material", "colour", "finish", "price"])),
  category("basin-mixers", "Basin Mixers", "Bathroom", ["bathroom", "ensuite", "powder-room"], ["tapware", "basin-mixer"], resolveProductLibraryImage({ familyKey: "tapware" }), filters(["brand", "type", "finish", "wels", "range", "price"])),
  category("bath-mixers", "Bath Mixers", "Bathroom", ["bathroom", "ensuite"], ["tapware"], resolveProductLibraryImage({ familyKey: "tapware" }), filters(["brand", "type", "finish", "wels", "range", "price"])),
  category("shower-mixers", "Shower Mixers", "Bathroom", ["bathroom", "ensuite"], ["tapware", "shower-mixer"], resolveProductLibraryImage({ familyKey: "tapware" }), filters(["brand", "type", "finish", "wels", "range", "price"])),
  category("shower-rails", "Shower Rails", "Bathroom", ["bathroom", "ensuite"], ["shower-outlet"], resolveProductLibraryImage({ familyKey: "tapware" }), filters(["brand", "finish", "wels", "price"])),
  category("shower-heads", "Shower Heads", "Bathroom", ["bathroom", "ensuite"], ["shower-outlet"], resolveProductLibraryImage({ familyKey: "tapware" }), filters(["brand", "finish", "wels", "price"])),
  category("baths", "Baths", "Bathroom", ["bathroom", "ensuite"], ["bath"], resolveProductLibraryImage({ familyKey: "bath" }), filters(["brand", "material", "size", "price"])),
  category("basins", "Basins", "Bathroom", ["bathroom", "ensuite", "powder-room"], ["basin"], resolveProductLibraryImage({ familyKey: "basin" }), filters(["brand", "material", "colour", "mounting", "price"])),
  category("toilets", "Toilets", "Bathroom", ["bathroom", "ensuite", "powder-room"], ["toilet"], resolveProductLibraryImage({ familyKey: "toilet" }), filters(["brand", "type", "wels", "price"])),
  category("vanities", "Vanities", "Bathroom", ["bathroom", "ensuite", "powder-room"], ["vanity", "cabinetry"], resolveProductLibraryImage({ familyKey: "vanity" }), filters(["brand", "size", "finish", "price"])),
  category("shaving-cabinets", "Shaving Cabinets", "Bathroom", ["bathroom", "ensuite", "powder-room"], ["cabinetry"], resolveProductLibraryImage({ familyKey: "cabinetry" }), filters(["brand", "size", "finish", "price"])),
  category("bathroom-accessories", "Bathroom Accessories", "Bathroom", ["bathroom", "ensuite", "powder-room"], ["accessories"], resolveProductLibraryImage({ familyKey: "accessories" }), filters(["brand", "finish", "range", "price"])),
  category("towel-rails", "Towel Rails", "Bathroom", ["bathroom", "ensuite", "powder-room", "laundry"], ["accessories"], resolveProductLibraryImage({ familyKey: "accessories" }), filters(["brand", "finish", "size", "price"])),
  category("floor-wastes", "Floor Wastes", "Bathroom", ["bathroom", "ensuite", "powder-room", "laundry"], ["accessories"], resolveProductLibraryImage({ familyKey: "accessories" }), filters(["brand", "finish", "size", "price"])),
  category("tapware", "Tapware", "Bathroom", ["bathroom", "ensuite", "powder-room", "laundry"], ["tapware", "basin-mixer", "shower-mixer", "shower-outlet"], resolveProductLibraryImage({ familyKey: "tapware" }), filters(["brand", "type", "finish", "wels", "range", "price"])),
  category("laundry-tubs", "Laundry Tubs", "Laundry", ["laundry"], ["kitchen-sinks"], resolveProductLibraryImage({ familyKey: "kitchen-sinks" }), filters(["brand", "material", "width", "price"])),
  category("laundry-mixers", "Laundry Mixers", "Laundry", ["laundry"], ["tapware", "kitchen-sink-mixers"], resolveProductLibraryImage({ familyKey: "tapware" }), filters(["brand", "finish", "wels", "range", "price"])),
  category("washing-machines", "Washing Machines", "Laundry", ["laundry"], ["washing-machines"], "/images/catalogues/appliances/fallbacks/generic.svg", filters(["brand", "capacity", "price"])),
  category("clothes-dryers", "Clothes Dryers", "Laundry", ["laundry"], ["clothes-dryers"], "/images/catalogues/appliances/fallbacks/generic.svg", filters(["brand", "capacity", "price"])),
  category("internal-doors", "Internal Doors", "Internal", ["bedrooms", "internal-areas", "garage"], ["internal-doors"], "/images/product-library/internal-areas/category-internal-door.webp", filters(["brand", "range", "size", "finish", "price"])),
  category("door-furniture", "Internal Door Furniture", "Internal", ["bedrooms", "internal-areas", "garage"], ["door-hardware"], "/images/product-library/internal-areas/category-internal-handle.webp", filters(["brand", "range", "finish", "price"])),
  category("skirting-architraves", "Skirting & Architraves", "Internal", ["living-areas", "bedrooms", "internal-areas"], ["skirting", "architraves"], "/images/product-library/internal-areas/category-skirting-architraves.webp", filters(["brand", "profile", "size", "price"])),
  category("skirting", "Skirting", "Internal", ["living-areas", "bedrooms", "internal-areas"], ["skirting"], resolveProductLibraryImage({ familyKey: "internal-doors" }), filters(["brand", "profile", "size", "price"])),
  category("architraves", "Architraves", "Internal", ["living-areas", "bedrooms", "internal-areas"], ["architraves"], resolveProductLibraryImage({ familyKey: "internal-doors" }), filters(["brand", "profile", "size", "price"])),
  category("wardrobe-systems", "Wardrobe Systems", "Internal", ["bedrooms", "internal-areas"], ["robes"], resolveProductLibraryImage({ familyKey: "robes" }), filters(["brand", "range", "finish", "price"])),
  category("shelving", "Shelving", "Internal", ["kitchen", "butlers-pantry", "laundry", "bedrooms", "internal-areas"], ["cabinetry", "robes"], resolveProductLibraryImage({ familyKey: "cabinetry" }), filters(["brand", "material", "finish", "price"])),
  category("stair-components", "Stair Components", "Internal", ["internal-areas"], ["stairs"], resolveProductLibraryImage({ familyKey: "stairs" }), filters(["brand", "material", "finish", "price"])),
  category("flooring", "Flooring", "Finishes", ["kitchen", "butlers-pantry", "bathroom", "ensuite", "powder-room", "laundry", "living-areas", "bedrooms", "internal-areas", "garage"], ["flooring", "tiles"], resolveProductLibraryImage({ familyKey: "flooring" }), filters(["brand", "material", "colour", "finish", "price"])),
  category("tiles", "Tiles", "Finishes", ["bathroom", "ensuite", "powder-room", "laundry"], ["tiles", "floor-tiles", "wall-tiles", "feature-tiles"], resolveProductLibraryImage({ familyKey: "tiles" }), filters(["brand", "format", "colour", "finish", "price"])),
  category("lighting", "Lighting", "Electrical", ["kitchen", "butlers-pantry", "bathroom", "ensuite", "powder-room", "laundry", "living-areas", "bedrooms", "internal-areas", "garage", "alfresco-outdoor"], ["lighting", "external-lighting"], resolveProductLibraryImage({ familyKey: "lighting" }), filters(["brand", "type", "finish", "price"])),
  category("internal-paint-colours", "Internal Paint Colours", "Finishes", ["living-areas", "bedrooms", "internal-areas"], ["paint"], resolveProductLibraryImage({ familyKey: "paint" }), filters(["brand", "range", "colour", "finish", "price"])),
  category("electrical-fixtures", "Electrical Fixtures", "Electrical", ["living-areas", "bedrooms", "internal-areas", "garage"], ["lighting"], resolveProductLibraryImage({ familyKey: "lighting" }), filters(["brand", "type", "finish", "price"])),
  category("roofing", "Roofing", "Exterior", ["exterior"], ["roofing", "gutters-fascia"], resolveProductLibraryImage({ familyKey: "roofing" }), filters(["brand", "profile", "colour", "finish", "price"])),
  category("gutters", "Gutters", "Exterior", [], ["gutters-fascia"], resolveProductLibraryImage({ familyKey: "gutters-fascia" }), filters(["brand", "profile", "colour", "price"])),
  category("fascia", "Fascia", "Exterior", [], ["gutters-fascia"], resolveProductLibraryImage({ familyKey: "gutters-fascia" }), filters(["brand", "colour", "price"])),
  category("downpipes", "Downpipes", "Exterior", [], ["gutters-fascia"], resolveProductLibraryImage({ familyKey: "gutters-fascia" }), filters(["brand", "colour", "price"])),
  category("external-cladding", "External Cladding", "Exterior", ["exterior"], ["cladding"], resolveProductLibraryImage({ familyKey: "cladding" }), filters(["brand", "material", "profile", "colour", "price"])),
  category("bricks", "Bricks", "Exterior", ["exterior"], ["bricks"], asset("/images/catalogues/product-library/categories/exterior-brickwork.webp", "https://australbricks.com.au/sqld/product/coastal?v=3165", "Austral Bricks Coastal Double Height Shoreline brickwork sample, stored locally for the Bricks category card."), filters(["brand", "range", "colour", "price"])),
  category("entry-doors", "Entry Doors & Door Furniture", "Exterior", ["exterior"], ["entry-doors", "entry-door-furniture", "door-hardware", "handles"], ENTRANCE_HARDWARE_IMAGE, filters(["brand", "range", "size", "finish", "price"])),
  category("external-door-furniture", "External Door Furniture", "Exterior", [], ["door-hardware", "handles", "entry-door-furniture"], ENTRANCE_HARDWARE_IMAGE, filters(["brand", "range", "finish", "price"])),
  category("windows", "Windows", "Exterior", ["exterior"], ["windows"], resolveProductLibraryImage({ familyKey: "windows" }), filters(["brand", "type", "colour", "size", "price"])),
  category("garage-doors", "Garage Doors", "Exterior", ["garage", "exterior"], ["garage-doors"], resolveProductLibraryImage({ familyKey: "garage-doors" }), filters(["brand", "range", "size", "finish", "price"])),
  category("external-lighting", "External Lighting", "Exterior", ["exterior", "garage", "alfresco-outdoor"], ["external-lighting"], resolveProductLibraryImage({ familyKey: "external-lighting" }), filters(["brand", "type", "finish", "price"])),
  category("driveway-finishes", "Driveway Finishes", "Exterior", ["exterior", "garage"], ["driveway"], resolveProductLibraryImage({ familyKey: "driveway" }), filters(["brand", "material", "colour", "price"])),
  category("exterior-paint-colours", "Exterior Paint Colours", "Exterior", ["exterior"], ["exterior-paint"], resolveProductLibraryImage({ familyKey: "exterior-paint" }), filters(["brand", "range", "colour", "finish", "price"])),
  category("decking", "Decking", "Outdoor", ["alfresco-outdoor"], ["decking"], resolveProductLibraryImage({ familyKey: "decking" }), filters(["brand", "material", "colour", "price"])),
  category("balustrades", "Balustrades", "Outdoor", ["alfresco-outdoor", "exterior"], ["balustrades"], resolveProductLibraryImage({ familyKey: "balustrades" }), filters(["brand", "material", "finish", "price"])),
  category("landscaping", "Landscaping", "Outdoor", ["alfresco-outdoor"], ["landscaping", "retaining-walls"], resolveProductLibraryImage({ familyKey: "landscaping" }), filters(["brand", "material", "price"])),
];

export const PRODUCT_LIBRARY_ROOM_BY_KEY = new Map(PRODUCT_LIBRARY_ROOMS.map((item) => [item.key, item]));
export const PRODUCT_LIBRARY_ROOM_CATEGORY_BY_KEY = new Map(PRODUCT_LIBRARY_ROOM_CATEGORIES.map((item) => [item.key, item]));

export const PRODUCT_LIBRARY_CATALOGUE_SECTIONS = [
  section("appliances", "Appliances & White Goods", "Appliance brands, individual products and package bundles.", ["ovens", "cooktops", "rangehoods", "dishwashers", "freestanding-cookers", "microwaves", "fridges", "appliance-packs"], "/images/catalogues/appliances/fallbacks/appliance-pack.svg"),
  section("cabinetry-joinery", "Cabinetry", "Cabinetry products, doors, panels, board finishes, handles, hardware, benchtops and accessories.", ["cabinetry", "cabinet-finish", "handles", "stone-benchtops", "stone-20mm-tops", "stone-40mm-tops"], resolveProductLibraryImage({ familyKey: "cabinetry" })),
  section("plumbing-fixtures-tapware", "Plumbing Fixtures & Tapware", "Sinks, basins, showers, toilets, baths, wet-area fixtures, mixers, taps and outlets.", ["kitchen-sinks", "vanity", "basin", "shower-screen", "bath", "toilet", "accessories", "kitchen-sink-mixers", "tapware", "basin-mixer", "shower-mixer", "shower-outlet"], resolveProductLibraryImage({ familyKey: "kitchen-sinks" })),
  section("doors-door-furniture", "Doors & Door Furniture", "Internal doors, entry doors, garage doors and door furniture.", ["internal-doors", "entry-doors", "garage-doors", "door-hardware"], resolveProductLibraryImage({ familyKey: "internal-doors" })),
  section("windows", "Windows", "Window frames, glazing and opening products.", ["windows"], resolveProductLibraryImage({ familyKey: "windows" })),
  section("roofing", "Roofing", "Roofing systems, roof tiles, gutters, fascia and downpipes.", ["roofing", "gutters-fascia"], resolveProductLibraryImage({ familyKey: "roofing" })),
  section("cladding", "Cladding", "External cladding, brick, render and wall finish products.", ["cladding", "bricks", "feature-bricks"], resolveProductLibraryImage({ familyKey: "cladding" })),
  section("flooring", "Flooring", "Carpet, timber, vinyl, hybrid, laminate and other floor finishes.", ["flooring"], resolveProductLibraryImage({ familyKey: "flooring" })),
  section("tiles", "Tiles", "Floor tiles, wall tiles, feature tiles and wet-area tile products.", ["tiles", "floor-tiles", "wall-tiles", "feature-tiles"], resolveProductLibraryImage({ familyKey: "tiles" })),
  section("painting", "Painting", "Paint brands, product systems, colour selections and finishes.", ["paint", "exterior-paint"], resolveProductLibraryImage({ familyKey: "paint" })),
  section("lighting-electrical", "Lighting & Electrical", "Internal and external lighting, power points, switches, fans, alarms and electrical accessories.", ["lighting", "external-lighting", "electrical", "electrical-fixtures"], resolveProductLibraryImage({ familyKey: "lighting" })),
  section("fix-out", "Fix Out", "Doors, trims, skirting, architraves, robes and final fit-off products.", ["internal-doors", "door-hardware", "skirting", "architraves", "robes", "handles"], resolveProductLibraryImage({ familyKey: "internal-doors" })),
  section("external-products", "External Products", "External finishes, openings, decking, driveways, balustrades and outdoor products.", ["bricks", "cladding", "roofing", "windows", "entry-doors", "garage-doors", "gutters-fascia", "balustrades", "decking", "driveway", "retaining-walls", "landscaping", "pool"], resolveProductLibraryImage({ familyKey: "decking" })),
];

export const PRODUCT_LIBRARY_SECTION_BY_KEY = new Map(PRODUCT_LIBRARY_CATALOGUE_SECTIONS.map((item) => [item.key, item]));

export function getProductLibraryCatalogueSection(sectionKey) {
  return PRODUCT_LIBRARY_SECTION_BY_KEY.get(sectionKey) || null;
}

export function getProductLibrarySectionFamilies(sectionKey) {
  const sectionItem = getProductLibraryCatalogueSection(sectionKey);
  if (!sectionItem) return [];
  const keys = new Set(sectionItem.familyKeys);
  return PRODUCT_FAMILIES.filter((family) => keys.has(family.familyKey));
}

export function getProductLibraryRoom(roomKey) {
  return PRODUCT_LIBRARY_ROOM_BY_KEY.get(roomKey) || null;
}

export function getProductLibraryRoomCategories(roomKey) {
  return PRODUCT_LIBRARY_ROOM_CATEGORIES
    .filter((categoryItem) => !["skirting", "architraves"].includes(categoryItem.key))
    .filter((categoryItem) => categoryItem.applicableRoomIds.includes(roomKey))
    .sort((left, right) => left.displayOrder - right.displayOrder || left.name.localeCompare(right.name));
}

export function getProductLibraryRoomCategory(categoryKey) {
  return PRODUCT_LIBRARY_ROOM_CATEGORY_BY_KEY.get(categoryKey) || null;
}

export function productBelongsToRoomCategory(product = {}, categoryItem = null) {
  if (!categoryItem) return false;
  if (["skirting", "architraves", "skirting-architraves"].includes(categoryItem.key) && product.attributes?.productTypes?.includes("Architraves") && product.attributes?.productTypes?.includes("Skirting")) return true;
  if (["gutters", "fascia", "downpipes"].includes(categoryItem.key)) return exteriorSectionForProduct(product, "roofing") === categoryItem.key;
  if (categoryItem.key === "entry-doors") return Boolean(exteriorSectionForProduct(product, "entry-doors"));
  if (categoryItem.key === "external-door-furniture") return isExternalDoorHardware(product);
  if (categoryItem.key === "door-furniture") return product.familyKey === "door-hardware" && /internal[- ]door/i.test(product.attributes?.handleUse || "");
  const productFamily = product.familyKey || product.familyId || "";
  if (!categoryItem.familyKeys.includes(productFamily) && !productMatchesAliasedCategory(product, categoryItem.key)) return false;
  if (productFamily === "cabinetry") return productMatchesCabinetryCategory(product, categoryItem.key);
  if (productFamily === "handles") return productMatchesHandleCategory(product, categoryItem.key);
  if (productFamily === "tapware") return productMatchesPlumbingCategory(product, categoryItem.key);
  if (productFamily === "tiles") return productMatchesTileCategory(product, categoryItem.key);
  if (productFamily === "roofing") return productMatchesRoofingCategory(product, categoryItem.key);
  return true;
}

function productMatchesCabinetryCategory(product = {}, categoryKey = "") {
  if (categoryKey === "cabinetry-products") return product.categoryKey === "Cabinetry Products";
  const canonicalType = product.attributes?.canonicalType || product.attributes?.categoryType || "";
  const categoryText = `${product.categoryKey || ""} ${product.range || ""} ${product.productName || ""} ${product.model || ""} ${product.description || ""} ${product.attributes?.fixtureType || ""}`.toLowerCase();
  if (categoryKey === "cabinet-hardware") return canonicalType === "hardware_product";
  if (categoryKey === "shelving") return canonicalType === "shelving_feature" && /shelv|robe|rail|wine/.test(categoryText);
  if (categoryKey === "vanities") return canonicalType === "cabinet_unit" && /vanity|bath-floor|bath-wall/.test(categoryText);
  if (categoryKey === "shaving-cabinets") return canonicalType === "cabinet_unit" && /shaving/.test(categoryText);
  if (categoryKey === "wardrobe-systems") return /robe|hanging rail|linen/.test(categoryText);
  if (categoryKey === "cabinetry") return canonicalType === "cabinet_unit" || canonicalType === "assembly_pricing_line" || canonicalType === "shelving_feature";
  return true;
}

function productMatchesAliasedCategory(product = {}, categoryKey = "") {
  const familyKey = product.familyKey || product.familyId || "";
  if (["gutters", "fascia", "downpipes"].includes(categoryKey) && familyKey === "roofing") return true;
  if (["basins", "toilets", "basin-mixers", "bath-mixers", "shower-mixers", "tapware"].includes(categoryKey) && familyKey === "tapware") return true;
  if (["floor-tiles", "wall-tiles", "feature-tiles"].includes(categoryKey) && familyKey === "tiles") return true;
  return false;
}

function productMatchesHandleCategory(product = {}, categoryKey = "") {
  const handleUse = String(product.attributes?.handleUse || product.attributes?.choiceType || product.categoryKey || "").toLowerCase();
  if (categoryKey === "external-door-furniture") return /entry-door|external-door/.test(handleUse);
  if (categoryKey === "cabinet-handles") return !/entry[- ]door|external[- ]door|internal[- ]door/.test(handleUse);
  return true;
}

function productMatchesPlumbingCategory(product = {}, categoryKey = "") {
  const fixtureType = String(product.attributes?.fixtureType || product.categoryKey || product.productName || "").toLowerCase();
  if (categoryKey === "basins") return /basin/.test(fixtureType) && !/mixer/.test(fixtureType);
  if (categoryKey === "toilets") return /toilet/.test(fixtureType);
  if (categoryKey === "basin-mixers") return /basin-mixer|mixer/.test(fixtureType);
  if (categoryKey === "bath-mixers") return /bath-mixer|bath tap/.test(fixtureType);
  if (categoryKey === "shower-mixers") return /shower-mixer/.test(fixtureType);
  if (categoryKey === "tapware") return /mixer|tap|shower/.test(fixtureType);
  return true;
}

function productMatchesTileCategory(product = {}, categoryKey = "") {
  const fixtureType = String(product.attributes?.fixtureType || product.categoryKey || product.productName || "").toLowerCase();
  if (categoryKey === "floor-tiles") return /floor/.test(fixtureType);
  if (categoryKey === "wall-tiles") return /wall/.test(fixtureType);
  if (categoryKey === "feature-tiles") return /feature/.test(fixtureType);
  return true;
}

function productMatchesRoofingCategory(product = {}, categoryKey = "") {
  const step = String(product.attributes?.roofPackageStep || product.attributes?.configuration || product.configuration || product.categoryKey || product.productName || "").toLowerCase();
  if (categoryKey === "gutters") return /gutter/.test(step);
  if (categoryKey === "fascia") return /fascia/.test(step);
  if (categoryKey === "downpipes") return /downpipe/.test(step);
  return true;
}

export function productBelongsToRoom(product = {}, roomKey = "") {
  if (product.familyKey === 'entry-door-furniture') return roomKey === 'exterior';
  if (roomKey === 'exterior' && ['door-hardware','handles'].includes(product.familyKey) && !/entry|entrance|exterior|external/i.test([product.productName, product.attributes?.handleUse, product.attributes?.doorCompatibility].filter(Boolean).join(' '))) return false;
  const explicitRooms = product.applicableRooms || product.attributes?.applicableRooms || [];
  if (Array.isArray(explicitRooms) && explicitRooms.map((item) => String(item).toLowerCase()).includes(roomKey)) return true;
  return getProductLibraryRoomCategories(roomKey).some((categoryItem) => productBelongsToRoomCategory(product, categoryItem));
}

export function resolveProductLibrarySectionForFamily(familyKey = "") {
  const key = String(familyKey || "").trim();
  return PRODUCT_LIBRARY_CATALOGUE_SECTIONS.find((sectionItem) => sectionItem.familyKeys.includes(key)) || null;
}

export function resolveQuotationBuilderMappingForProduct(product = {}) {
  if (product.sourceType === "canonical_cabinetry_workflow") {
    const categoryIds = { "Cabinetry Products": "cabinetry-products", "Cabinet Hardware": "cabinet-hardware", "Cabinet Doors & Panels": "cabinet-doors-panels" };
    return {
      quotationSectionId: "cabinetry-joinery",
      quotationSection: "Cabinetry",
      quotationSubsectionId: categoryIds[product.categoryKey] || product.categoryKey,
      quotationSubsection: product.categoryKey,
      quotationLineCategory: product.attributes?.canonicalType || "cabinetry",
    };
  }
  const exteriorParent = exteriorSectionForProduct(product, "roofing") ? "roofing" : exteriorSectionForProduct(product, "entry-doors") ? "entry-doors" : "";
  if (exteriorParent) {
    const subsection = exteriorSectionForProduct(product, exteriorParent);
    return {
      quotationSectionId: exteriorParent === "roofing" ? "roofing" : "doors-door-furniture",
      quotationSection: exteriorParent === "roofing" ? "Roofing" : "Doors & Door Furniture",
      quotationSubsectionId: subsection,
      quotationSubsection: EXTERIOR_CATALOGUE_SECTIONS[exteriorParent].find(([key]) => key === subsection)?.[1] || subsection,
      quotationLineCategory: subsection,
    };
  }
  const familyKey = product.familyKey || product.familyId || "";
  const categoryItem = PRODUCT_LIBRARY_ROOM_CATEGORIES.find((item) => productBelongsToRoomCategory(product, item)) || null;
  const directSection = resolveProductLibrarySectionForFamily(familyKey);
  const section = sectionForQuotationFamily(product, categoryItem?.key) || directSection;
  const subsection = categoryItem?.name || product.category || product.categoryKey || product.familyKey || "";
  const lineCategory = product.attributes?.quotationLineCategory
    || product.attributes?.fixtureType
    || product.attributes?.canonicalType
    || product.productType
    || familyKey;
  return {
    quotationSectionId: section?.key || "",
    quotationSection: section?.displayName || "",
    quotationSubsectionId: categoryItem?.key || product.categoryKey || "",
    quotationSubsection: subsection,
    quotationLineCategory: lineCategory,
  };
}

function sectionForQuotationFamily(product = {}, categoryKey = "") {
  const familyKey = product.familyKey || product.familyId || "";
  const categoryText = [
    categoryKey,
    product.categoryKey,
    product.category,
    product.requirementKeys,
    product.requirement_keys,
    product.productName,
    product.attributes?.handleUse,
    product.attributes?.choiceType,
    product.attributes?.quotationMappingId,
  ].filter(Boolean).join(" ").toLowerCase();
  if (["kitchen-sink-mixers", "tapware", "basin-mixer", "shower-mixer", "shower-outlet", "kitchen-sinks", "vanity", "basin", "shower-screen", "bath", "toilet", "accessories"].includes(familyKey)) return getProductLibraryCatalogueSection("plumbing-fixtures-tapware");
  if (familyKey === "handles" && /entry|external|door/.test(categoryText)) return getProductLibraryCatalogueSection("doors-door-furniture");
  if (["stone-benchtops", "stone-20mm-tops", "stone-40mm-tops"].includes(familyKey)) return getProductLibraryCatalogueSection("cabinetry-joinery");
  if (["windows"].includes(familyKey)) return getProductLibraryCatalogueSection("windows");
  if (["entry-doors", "garage-doors"].includes(familyKey)) return getProductLibraryCatalogueSection("doors-door-furniture");
  if (["roofing", "gutters-fascia"].includes(familyKey)) return getProductLibraryCatalogueSection("roofing");
  if (["cladding", "bricks", "feature-bricks"].includes(familyKey)) return getProductLibraryCatalogueSection("cladding");
  if (["paint", "exterior-paint"].includes(familyKey)) return getProductLibraryCatalogueSection("painting");
  if (["lighting", "external-lighting", "electrical", "electrical-fixtures"].includes(familyKey)) return getProductLibraryCatalogueSection("lighting-electrical");
  return null;
}

export function resolveProductLibrarySectionForQuotationRow(row = {}) {
  const text = [
    row.category_id,
    row.subcategory_id,
    row.current_description,
    row.quotation_code,
  ].join(" ").toLowerCase();

  if (/appliance|oven|cooktop|rangehood|range hood|dishwasher|freestanding cooker|fridge|microwave/.test(text)) return "appliances";
  if (/entry door|entrance|external door|door handle|door hardware|lockset|deadbolt|mortice|digital lock/.test(text)) return "doors-door-furniture";
  if (/cabinet|joinery|laminex|polytec|handle|blum|shelv|bulkhead|kick panel/.test(text)) return "cabinetry-joinery";
  if (/stone|benchtop|caesarstone|neolith|smartstone|ambassador|splashback/.test(text)) return "cabinetry-joinery";
  if (/plumb|sink|mixer|tap|basin|bath|toilet|shower|vanity|laundry tub/.test(text)) return "plumbing-fixtures-tapware";
  if (/electric|light|power point|switch|fan/.test(text)) return "lighting-electrical";
  if (/window/.test(text)) return "windows";
  if (/entry door|external door|garage door|internal door|door hardware|privacy set|passage set|hinge/.test(text)) return "doors-door-furniture";
  if (/roof|gutter|fascia|downpipe|rainwater/.test(text)) return "roofing";
  if (/wall|ceiling|cladding|brick|weatherboard|render/.test(text)) return "cladding";
  if (/floor|carpet|vinyl|hybrid|timber floor|laminate/.test(text)) return "flooring";
  if (/tile/.test(text)) return "tiles";
  if (/paint|colour/.test(text)) return "painting";
  if (/skirting|architrave|robe|fix out|fit off/.test(text)) return "fix-out";
  if (/driveway|deck|balustrade|retaining|landscap|pool|external/.test(text)) return "external-products";
  return "external-products";
}

function section(key, displayName, description, familyKeys, image) {
  return {
    key,
    displayName,
    description,
    familyKeys,
    image,
  };
}

function asset(image, sourceUrl, attribution) {
  return { image, sourceUrl, attribution };
}

function imageFromAsset(imageOrAsset) {
  if (imageOrAsset && typeof imageOrAsset === "object") return imageOrAsset.image || "";
  return imageOrAsset || "";
}

function room(key, name, description, heroImage, displayOrder) {
  const heroAsset = heroImage && typeof heroImage === "object" ? heroImage : null;
  return {
    id: `room:${key}`,
    key,
    slug: key,
    name,
    description,
    heroImage: imageFromAsset(heroImage) || resolveProductLibraryImage({ familyKey: "tapware" }) || "/images/catalogues/appliances/fallbacks/generic.svg",
    imageSourceUrl: heroAsset?.sourceUrl || "",
    imageAttribution: heroAsset?.attribution || "",
    displayOrder,
    active: true,
  };
}

function category(key, name, group, applicableRoomIds, familyKeys, image, filterDefinitions = []) {
  const imageAsset = image && typeof image === "object" ? image : null;
  return {
    id: `category:${key}`,
    key,
    slug: key,
    name,
    group,
    representativeImage: imageFromAsset(image) || resolveProductLibraryImage({ familyKey: familyKeys[0] }) || "/images/catalogues/appliances/fallbacks/generic.svg",
    imageSourceUrl: imageAsset?.sourceUrl || "",
    imageAttribution: imageAsset?.attribution || "",
    applicableRoomIds,
    familyKeys,
    filterDefinitions,
    displayOrder: roomCategoryDisplayOrder += 1,
    active: true,
  };
}

function filters(keys) {
  return keys.map((key) => ({ key, label: labelForFilter(key) }));
}

function labelForFilter(key) {
  return String(key || "")
    .replace(/([A-Z])/g, " $1")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}
