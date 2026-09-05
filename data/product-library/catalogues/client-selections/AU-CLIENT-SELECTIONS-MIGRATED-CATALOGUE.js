const VERIFIED_AT = "2026-09-04";
const SOURCE_NAME = "Client Selections one-time migration";
const SOURCE_URL = "pages/modules/builders/selections-book.js";

const ROOM_GROUPS = {
  kitchen: ["kitchen", "butlers-pantry"],
  wetAreas: ["bathroom", "ensuite", "powder-room"],
  wetAndLaundry: ["bathroom", "ensuite", "powder-room", "laundry"],
  interior: ["living-areas", "bedrooms", "internal-areas"],
  exterior: ["exterior"],
};

const legacyProducts = [
  migratedOption("oven", "Westinghouse", "Westinghouse 600mm Oven", "WVE6515SD", "Stainless steel", "Harvey Norman Commercial", "Westinghouse 600mm built-in electric oven.", 1200, 1200, "ovens", ROOM_GROUPS.kitchen, {
    primaryImageUrl: "/images/catalogues/appliances/products/westinghouse/westinghouse-wve6515sd.webp",
    thumbnailUrl: "/images/catalogues/appliances/products/westinghouse/westinghouse-wve6515sd-thumb.webp",
    imageSourceUrl: "https://www.westinghouse.com.au/resourceimageelectrolux/Public/Image2/product/113701/61865.png?width=900",
    imageSourceType: "official-australian-manufacturer-local",
    officialProductUrl: "https://www.westinghouse.com.au/cooking/ovens/wve6515sd/",
    imageAttribution: "Product image sourced from Westinghouse Australia official WVE6515SD product page.",
  }),
  migratedOption("oven", "Bosch", "Bosch Serie 6 Oven", "HBA534BS0A", "Stainless steel", "Harvey Norman Commercial", "Bosch Serie 6 built-in oven with premium controls.", 1200, 1780, "ovens", ROOM_GROUPS.kitchen, {
    primaryImageUrl: "/images/catalogues/appliances/products/bosch/bosch-hba534bs0a.webp",
    thumbnailUrl: "/images/catalogues/appliances/products/bosch/bosch-hba534bs0a-thumb.webp",
    imageSourceUrl: "https://media3.bsh-group.com/Product_Shots/MCSA01975329_HBA534BS0_FullSizeOven_Bosch_STP_EOX5_def.webp",
    imageSourceType: "official-australian-manufacturer-local",
    officialProductUrl: "https://www.bosch-home.com.au/en/mkt-product/HBA534BS0A",
    imageAttribution: "Product image sourced from Bosch Home Appliances Australia official HBA534BS0A page.",
  }),
  migratedOption("oven", "Smeg", "Smeg Classic Oven", "SFP6301TVX", "Stainless steel", "Harvey Norman Commercial", "Smeg classic built-in oven.", 1200, 2380, "ovens", ROOM_GROUPS.kitchen, {
    primaryImageUrl: "/images/catalogues/appliances/products/smeg/smeg-sfp6301tvx.webp",
    thumbnailUrl: "/images/catalogues/appliances/products/smeg/smeg-sfp6301tvx-thumb.webp",
    imageSourceUrl: "https://assets.4flow.cloud/SFP6301TVX.jpg",
    imageSourceType: "official-manufacturer-local",
    officialProductUrl: "https://www.smeg.com/products/SFP6301TVX",
    imageAttribution: "Product image sourced from Smeg official SFP6301TVX product page. Legacy Client Selections SKU SFA6301TVX was corrected to the verifiable SFP6301TVX model.",
  }),
  migratedOption("cooktop", "Westinghouse", "Westinghouse 600mm Gas Cooktop", "WHG644SC", "Stainless steel", "Harvey Norman Commercial", "Westinghouse 600mm stainless gas cooktop.", 850, 850, "cooktops", ROOM_GROUPS.kitchen),
  migratedOption("cooktop", "Bosch", "Bosch 600mm Gas Cooktop", "PCR6A5B90A", "Stainless steel", "Harvey Norman Commercial", "Bosch 600mm gas cooktop.", 850, 1270, "cooktops", ROOM_GROUPS.kitchen),
  migratedOption("cooktop", "Smeg", "Smeg 750mm Gas Cooktop", "PGA75", "Stainless steel", "Harvey Norman Commercial", "Smeg 750mm gas cooktop.", 850, 2030, "cooktops", ROOM_GROUPS.kitchen),
  migratedOption("rangehood", "Westinghouse", "Westinghouse Slideout Rangehood", "WRR604SB", "Stainless steel", "Harvey Norman Commercial", "Westinghouse 600mm slideout rangehood.", 520, 520, "rangehoods", ROOM_GROUPS.kitchen),
  migratedOption("rangehood", "Bosch", "Bosch Canopy Rangehood", "DWP66BC50A", "Stainless steel", "Harvey Norman Commercial", "Bosch 600mm canopy rangehood.", 520, 980, "rangehoods", ROOM_GROUPS.kitchen),
  migratedOption("dishwasher", "Westinghouse", "Westinghouse Dishwasher", "WSF6606XA", "Stainless steel", "Harvey Norman Commercial", "Westinghouse freestanding dishwasher.", 850, 850, "dishwashers", ROOM_GROUPS.kitchen),
  migratedOption("dishwasher", "Bosch", "Bosch Serie 4 Dishwasher", "SMS4HTI01A", "Stainless steel", "Harvey Norman Commercial", "Bosch Serie 4 dishwasher.", 850, 1320, "dishwashers", ROOM_GROUPS.kitchen),
  migratedOption("microwave", "Westinghouse", "Westinghouse Microwave", "WMF2302WA", "White", "Harvey Norman Commercial", "Westinghouse microwave allowance.", 280, 280, "microwaves", ROOM_GROUPS.kitchen),
  migratedOption("microwave", "Bosch", "Bosch Built-in Microwave", "BFL523MS0A", "Stainless steel", "Harvey Norman Commercial", "Bosch built-in microwave.", 280, 890, "microwaves", ROOM_GROUPS.kitchen),
  migratedOption("sink", "Oliveri", "Oliveri Diaz Sink", "DZ153", "Stainless steel", "Reece", "Oliveri Diaz stainless steel inset sink.", 480, 480, "kitchen-sinks", ["kitchen", "butlers-pantry", "laundry"]),
  migratedOption("sink", "Franke", "Franke Mythos Sink", "MYX210-50", "Stainless steel", "Reece", "Franke undermount stainless sink.", 480, 1120, "kitchen-sinks", ["kitchen", "butlers-pantry", "laundry"]),
  migratedOption("kitchen-tap", "Phoenix", "Phoenix Vivid Sink Mixer", "VS733", "Chrome", "Reece", "Phoenix Vivid kitchen sink mixer.", 420, 420, "kitchen-sink-mixers", ["kitchen", "butlers-pantry", "laundry"]),
  migratedOption("kitchen-tap", "Caroma", "Caroma Urbane II Sink Mixer", "99616C", "Brushed nickel", "Reece", "Caroma premium kitchen mixer.", 420, 760, "kitchen-sink-mixers", ["kitchen", "butlers-pantry", "laundry"]),
  migratedOption("vanity", "Timberline", "Timberline Wall Hung Vanity", "Silk 1200", "Polyurethane white", "Reece", "Wall hung vanity with soft close drawers.", 1320, 1320, "cabinetry", ROOM_GROUPS.wetAreas, { canonicalType: "cabinet_unit", fixtureType: "vanity" }),
  migratedOption("vanity", "Timberline", "Timberline Premium Vanity", "Aria 1200", "Prime oak", "Reece", "Premium wall hung vanity with stone top allowance.", 1320, 2450, "cabinetry", ROOM_GROUPS.wetAreas, { canonicalType: "cabinet_unit", fixtureType: "vanity" }),
  migratedOption("basin", "Caroma", "Caroma Cube Basin", "Cube Above Counter", "White", "Reece", "Caroma ceramic above counter basin.", 350, 350, "tapware", ROOM_GROUPS.wetAreas, { fixtureType: "basin" }),
  migratedOption("basin", "Caroma", "Caroma Luna Basin", "Luna Inset", "White", "Reece", "Caroma premium inset basin.", 350, 620, "tapware", ROOM_GROUPS.wetAreas, { fixtureType: "basin" }),
  migratedOption("tap", "Phoenix", "Phoenix Vivid Basin Mixer", "Vivid Slimline", "Chrome", "Reece", "Phoenix Vivid basin mixer.", 290, 290, "tapware", ROOM_GROUPS.wetAreas, { fixtureType: "basin-mixer" }),
  migratedOption("tap", "Caroma", "Caroma Urbane II Mixer", "Urbane II", "Brushed nickel", "Reece", "Premium basin mixer.", 290, 580, "tapware", ROOM_GROUPS.wetAreas, { fixtureType: "basin-mixer" }),
  migratedOption("toilet", "Caroma", "Caroma Luna Toilet Suite", "Luna Cleanflush", "White", "Reece", "Caroma Luna back to wall toilet suite.", 620, 620, "tapware", ROOM_GROUPS.wetAreas, { fixtureType: "toilet" }),
  migratedOption("toilet", "Caroma", "Caroma Urbane II Toilet", "Urbane II Cleanflush", "White", "Reece", "Premium back to wall toilet suite.", 620, 980, "tapware", ROOM_GROUPS.wetAreas, { fixtureType: "toilet" }),
  migratedOption("floor-tile", "National Tiles", "Ceramic Floor Tile", "Manhattan 600x600", "Light grey", "National Tiles", "Ceramic floor tile 600 x 600mm.", 45, 45, "tiles", ROOM_GROUPS.wetAndLaundry, { fixtureType: "floor-tile", swatchHex: "#d8d2c8" }),
  migratedOption("floor-tile", "National Tiles", "Porcelain Floor Tile", "Stoneform 600x600", "Warm grey", "National Tiles", "Premium porcelain floor tile.", 45, 82, "tiles", ROOM_GROUPS.wetAndLaundry, { fixtureType: "floor-tile", swatchHex: "#c7beb3" }),
  migratedOption("wall-tile", "National Tiles", "Ceramic Wall Tile", "White Gloss Rectified", "White gloss", "National Tiles", "Ceramic wall tile 300 x 600mm.", 35, 35, "tiles", ROOM_GROUPS.wetAndLaundry, { fixtureType: "wall-tile", swatchHex: "#f4f2ee" }),
  migratedOption("wall-tile", "National Tiles", "Feature Wall Tile", "Travertine Look", "Ivory", "National Tiles", "Feature wall tile allowance.", 35, 76, "tiles", ROOM_GROUPS.wetAndLaundry, { fixtureType: "feature-tile", swatchHex: "#dfd1bd" }),
  migratedOption("carpet", "Godfrey Hirst", "Godfrey Hirst Carpet", "Apollo", "Grey", "Flooring Supplier", "Mid range carpet allowance.", 0, 0, "flooring", ["living-areas", "bedrooms", "internal-areas"], { material: "Carpet", swatchHex: "#a7a9a6" }),
  migratedOption("carpet", "Godfrey Hirst", "Godfrey Hirst Premium Carpet", "Wool Blend", "Warm grey", "Flooring Supplier", "Premium carpet allowance.", 0, 1800, "flooring", ["living-areas", "bedrooms", "internal-areas"], { material: "Carpet", swatchHex: "#8f918c" }),
  migratedOption("wall-paint", "Dulux", "Dulux Wash & Wear", "Low Sheen", "Natural White", "Dulux", "Dulux interior wall paint.", 0, 0, "paint", ROOM_GROUPS.interior, { fixtureType: "interior-paint", swatchHex: "#f3efe7" }),
  migratedOption("wall-paint", "Dulux", "Dulux Premium Interior", "Wash & Wear Plus", "Natural White", "Dulux", "Premium Dulux interior paint system.", 0, 650, "paint", ROOM_GROUPS.interior, { fixtureType: "interior-paint", swatchHex: "#eee7dc" }),
];

const entryDoorFurniture = [
  entryFurniture("GAINSBOROUGH-895TLE", "Gainsborough", "Trilock Traditional Double Cylinder Entrance Lever Set", "895TLE", "Traditional lever entrance set", "116mm lever", "Zinc alloy", ["Polished Brass", "Satin Chrome", "Bright Chrome"], "Trilock 3-in-1 passage, privacy and deadbolt", "Double cylinder", "Integrated latch and deadbolt", "60mm", "35-45mm", "https://images.salsify.com/image/upload/s--hkRrQ3o5--/r3yaqdbq2aebg3xqx1m4.jpg", "https://www.gainsboroughhardware.com.au/en/products/895TLE.html", "verified_package"),
  entryFurniture("GAINSBOROUGH-8951ANG", "Gainsborough", "Trilock Contemporary Angular Double Cylinder Entrance Set", "8951ANG", "Angular lever entrance set", "199mm lever/backplate assembly", "Zinc alloy", ["Satin Chrome", "Matt Black", "Bright Chrome"], "Trilock 3-in-1 passage, privacy and deadbolt", "Double cylinder", "Integrated latch and deadbolt", "60mm", "35-45mm", "https://images.salsify.com/image/upload/s--K6lYKs9M--/o3m9p7trvqwzkvadq3tu.jpg", "https://www.gainsboroughhardware.com.au/en/products/8951ANG.html", "verified_package"),
  entryFurniture("GAINSBOROUGH-8951HAR", "Gainsborough", "Trilock Cove Harper Double Cylinder Entrance Lever Set", "8951HAR", "Harper lever on Cove backplate", "186mm lever", "Zinc alloy", ["Satin Chrome", "Matt Black"], "Trilock 3-in-1 passage, privacy and deadbolt", "Double cylinder", "Integrated latch and deadbolt", "60mm", "35-45mm", "https://images.salsify.com/image/upload/s--hmnl23tx--/idkpqyd5azlhztcodrqc.jpg", "https://www.gainsboroughhardware.com.au/en/products/8951HAR.html", "verified_package"),
  entryFurniture("GAINSBOROUGH-8905ALL", "Gainsborough", "Trilock Omni Allure Double Cylinder Pull Handle Entrance Set", "8905ALL", "Integrated pull handle entrance set", "600mm pull handle", "Marine-grade 316 stainless steel pull handle", ["Satin Brass"], "Trilock 3-in-1 with concealed external lever", "Double cylinder", "Integrated latch and deadbolt", "60mm", "35-45mm", "https://images.salsify.com/image/upload/s--wDkHW_-g--/jv53zlkr3ovwqt5ab1v9.jpg", "https://www.gainsboroughhardware.com.au/en/products/8905ALL.html", "requires_supplier_confirmation"),
  entryFurniture("LOCKWOOD-PARADIGM-PULL-DEADBOLT", "Lockwood", "Lockwood Paradigm Pull Handle Lockset - Deadbolt", "Paradigm Pull Handle Lockset - Deadbolt", "Paradigm pull handle lockset", "", "Supplier specified", ["Matt black"], "Double cylinder deadbolt", "Double cylinder", "Deadbolt", "Supplier confirmation required", "Supplier confirmation required", "https://gw-assets.assaabloy.com/is/image/assaabloy/005-exterior-view-front", "https://www.lockweb.com.au/au/en/products/door-locks/deadbolts/paradigm-pull-handle-lockset-deadbolt", "requires_supplier_confirmation"),
  entryFurniture("LOCKWOOD-PARADIGM-PULL-SL-SC", "Lockwood", "Lockwood Paradigm Pull Handle Lockset - Self-Latching Single Cylinder", "Paradigm Pull Handle Lockset - Self-Latching Single Cylinder", "Paradigm pull handle lockset", "", "Supplier specified", ["Matt black"], "Self-latching deadlatch", "Single cylinder", "Self-latching", "Supplier confirmation required", "Supplier confirmation required", "https://gw-assets.assaabloy.com/is/image/assaabloy/1b587-i_paradigm_bolt_exteriordummy02", "https://www.lockweb.com.au/au/en/products/door-locks/locksets/lockwood-paradigm-pull-handle-lockset-self-latching-single-cylinder", "requires_supplier_confirmation"),
  entryFurniture("LOCKWOOD-PARADIGM-PULL-SL-DC", "Lockwood", "Lockwood Paradigm Pull Handle Lockset - Self-Latching Double Cylinder", "Paradigm Pull Handle Lockset - Self-Latching Double Cylinder", "Paradigm pull handle lockset", "", "Supplier specified", ["Matt black"], "Self-latching deadlatch", "Double cylinder", "Self-latching", "Supplier confirmation required", "Supplier confirmation required", "https://gw-assets.assaabloy.com/is/image/assaabloy/fd64e-c_paradigm_double-doorexterior01", "https://www.lockweb.com.au/au/en/products/door-locks/locksets/lockwood-paradigm-pull-handle-lockset-self-latching-double-cylinder", "requires_supplier_confirmation"),
  entryFurniture("ZANDA-ROUND-PULL-SUPPLIER-QUOTE", "Zanda", "Round Profile Straight Pull Handle with compatible roller-lock/deadbolt package", "Builder configuration required - supplier quote", "Round profile straight pull handle", "600mm or 900mm", "Supplier verified per selected finish", ["Satin Brass"], "Separate compatible roller lock/deadbolt", "Builder configuration required - supplier quote", "Separate compatible roller lock/deadbolt", "Supplier confirmation required", "Supplier confirmation required", "https://zanda.com.au/wp-content/uploads/2021/07/Round-Profile-Pull-Handle-Satin-Brass.jpg", "https://zanda.com.au/product/satin-brass-round-pull-handle-straight/", "requires_supplier_confirmation"),
  entryFurniture("ZANDA-POLO-OFFSET-SUPPLIER-QUOTE", "Zanda", "Polo Offset Pull Handle with compatible roller-lock/deadbolt package", "Builder configuration required - supplier quote", "Polo offset pull handle", "300mm, 450mm, 600mm, 900mm, 1200mm or 1800mm", "316 stainless steel where selected finish is stainless steel", ["316 Stainless Steel", "Matt Black"], "Separate compatible roller lock/deadbolt", "Builder configuration required - supplier quote", "Separate compatible roller lock/deadbolt", "Supplier confirmation required", "Supplier confirmation required", "https://zanda.com.au/wp-content/uploads/2021/07/Square-Profile-Pull-Handles-316SS.jpg", "https://zanda.com.au/product/polo-pull-handle/", "requires_supplier_confirmation"),
  entryFurniture("ZANDA-STREAMLINE-SUPPLIER-QUOTE", "Zanda", "Streamline Pull Handle with compatible roller-lock/deadbolt package", "Builder configuration required - supplier quote", "Streamline pull handle", "", "Supplier verified per selected finish", ["316 Stainless Steel", "Matt Black", "Graphite Nickel", "Satin Brass"], "Separate compatible roller lock/deadbolt", "Builder configuration required - supplier quote", "Separate compatible roller lock/deadbolt", "Supplier confirmation required", "Supplier confirmation required", "https://zanda.com.au/wp-content/uploads/2021/07/Square-Profile-Pull-Handles-316SS.jpg", "https://zanda.com.au/product/square-profile-straight/", "requires_supplier_confirmation"),
];

const humeGlassOptions = [
  glassOption("Clear", "Clear", "Clear", "Low privacy", "Highest natural light; transparent view through the glazed openings.", "https://cdn.shopify.com/s/files/1/0731/6868/3252/files/5b8d50a3bcd45bffb0ecfab63583a90f456b49a0-100x100.jpg"),
  glassOption("Cathedral", "Cathedral", "Patterned", "Moderate privacy", "Patterned glass admits light while softening the view through the openings.", "https://cdn.shopify.com/s/files/1/0731/6868/3252/files/db42cba743202e3ba5ef8ddd7f147c9b9489820b-250x250.jpg"),
  glassOption("Grey Tint", "Grey Tint", "Toned", "Low to moderate privacy", "Tinted glass reduces glare and darkens the glazed openings.", "https://cdn.shopify.com/s/files/1/0731/6868/3252/files/66fb235b118e8bc49ad4503032d522cfe4edac59-400x400.jpg"),
  glassOption("Translucent", "Translucent", "Obscure", "Higher privacy", "Diffused light with obscured direct view through the openings.", "https://cdn.shopify.com/s/files/1/0731/6868/3252/files/f30d19a63c77283990dfec574cb6b6ba5e59097b-100x100.jpg"),
  glassOption("Low E", "Low E", "Performance", "Low privacy", "Performance glass option; final visible light performance to be confirmed by Hume.", "https://cdn.shopify.com/s/files/1/0731/6868/3252/files/5b8d50a3bcd45bffb0ecfab63583a90f456b49a0-100x100.jpg"),
  glassOption("Rice Paper", "Rice Paper", "Patterned obscure", "Higher privacy", "Decorative obscure glass admits light while strongly softening the view.", "https://cdn.shopify.com/s/files/1/0731/6868/3252/files/25c2db8e4c442416bd7a39bb0f2d34212bb842a1-250x250.jpg"),
];

const exteriorColours = [
  colourProduct("dulux-dieskau-sn4h1", "Dulux", "Dulux Colours", "Dieskau", "SN4H1", "Greys", "#cbc9c5", "Painted exterior surfaces", "https://www.dulux.com.au/"),
  colourProduct("dulux-lexicon-quarter-sw1e1", "Dulux", "Whites and Neutrals", "Lexicon Quarter", "SW1E1", "Whites", "#f1f2f1", "Painted interior/exterior surfaces", "https://www.dulux.com.au/colour/whites-and-neutrals/lexicon-quarter/"),
  colourProduct("dulux-vivid-white-sw1g1", "Dulux", "Whites and Neutrals", "Vivid White", "SW1G1", "Whites", "#f7f8f4", "Painted interior/exterior surfaces", "https://www.dulux.com.au/colour/whites-and-neutrals/vivid-white/"),
  colourProduct("dulux-colorbond-monument-c29", "Dulux", "COLORBOND colours", "Colorbond Monument", "C29", "Charcoal", "#404141", "Painted exterior trim / COLORBOND match", "https://www.dulux.com.au/colour/colorbond/colorbond-monument/"),
  ...["Monument:#404141:Charcoal", "Surfmist:#d8d4c8:Off-whites", "Dune:#b8ad9c:Beige and stone", "Paperbark:#c5b596:Creams", "Jasper:#6a4f43:Browns", "Woodland Grey:#4d5148:Greens", "Pale Eucalypt:#7c8b75:Greens", "Mangrove:#4b5948:Greens", "Cottage Green:#314635:Greens", "Blue Gum:#7f8b8c:Blue-greens", "Deep Ocean:#364152:Blues", "Manor Red:#5c2c28:Reds", "Terrain:#8b4b3a:Terracotta", "Classic Cream:#e9dcb3:Creams"].map((row) => {
    const [name, hex, group] = row.split(":");
    return colourProduct(`colorbond-${slug(name)}`, "COLORBOND", "COLORBOND steel", name, "Manufacturer colour", group, hex, "Factory-finished steel", name === "Monument" ? "https://colorbond.com/colours/monument" : "https://colorbond.com/colours");
  }),
  colourProduct("natural-timber-stain", "Builder/Painter", "Timber stain", "Natural stain", "Project sample", "Timber tones", "#9b6a3c", "Stained timber", ""),
  colourProduct("clear-timber-finish", "Builder/Painter", "Timber finish", "Clear finish", "Project sample", "Timber tones", "#c69b6d", "Clear finished timber", ""),
];

export default {
  catalogueId: "AU-CLIENT-SELECTIONS-MIGRATED-CATALOGUE",
  catalogueName: "Client Selections migrated physical product options",
  source: SOURCE_URL,
  generatedAt: VERIFIED_AT,
  products: [
    ...legacyProducts,
    ...entryDoorFurniture,
    ...humeGlassOptions,
    ...exteriorColours,
  ],
};

function migratedOption(sourceKey, brand, productName, model, finish, supplier, description, allowance, selectedCost, familyKey, applicableRooms, extra = {}) {
  const id = `CS-${slug(sourceKey)}-${slug(brand)}-${slug(productName)}-${slug(model)}`;
  const swatchHex = extra.swatchHex || "";
  const swatchUrl = swatchHex ? swatchImage(`${brand} ${productName} ${finish}`, swatchHex) : "";
  const price = Number(selectedCost) || null;
  return {
    product_code: id,
    stable_product_id: `master-${id}`,
    family_key: familyKey,
    requirement_keys: familyKey,
    category_key: categoryForFamily(familyKey, extra.fixtureType),
    top_level_area: topLevelForFamily(familyKey),
    manufacturer: brand,
    brand,
    supplier,
    range: model,
    product_name: productName,
    model,
    description,
    colour: swatchHex ? finish : "",
    finish,
    size: sizeFromModel(model),
    material: extra.material || finish,
    primary_image_url: extra.primaryImageUrl || swatchUrl,
    thumbnail_url: extra.thumbnailUrl || extra.primaryImageUrl || swatchUrl,
    image_source_url: extra.imageSourceUrl || "",
    image_source_type: extra.imageSourceType || (swatchHex ? "colour_swatch" : "awaiting_exact_image_research"),
    image_verified_at: extra.primaryImageUrl || swatchHex ? VERIFIED_AT : "",
    image_status: extra.primaryImageUrl ? "verified_exact" : swatchHex ? "verified_exact" : "missing",
    official_product_url: extra.officialProductUrl || "",
    specification_url: extra.specificationUrl || extra.officialProductUrl || "",
    client_price: price,
    currency: "AUD",
    gst_included: true,
    price_unit: familyKey === "flooring" || familyKey === "tiles" ? "M2" : "EACH",
    price_status: price ? "current" : "quote_required",
    price_source_url: "",
    price_verified_at: price ? VERIFIED_AT : "",
    country: "AU",
    regions: "AU;QLD",
    active: true,
    discontinued: false,
    archived: false,
    source_type: "client_selections_legacy_migration",
    source_name: SOURCE_NAME,
    source_url: SOURCE_URL,
    source_verified_at: VERIFIED_AT,
    notes: "One-time migration from Client Selections PRODUCT_OPTION_LIBRARY. Generic legacy placeholder images were intentionally not imported.",
    colourSwatches: swatchHex ? [{ name: finish, hex: swatchHex }] : [],
    attributes: {
      applicableRooms,
      legacySourceKey: sourceKey,
      legacyClientSelectionId: slug(`${brand}-${productName}-${model}`),
      migratedFromClientSelections: true,
      catalogueOwner: "product-library",
      quotationMappingId: `approved-family:${familyKey}`,
      sourceAllowance: allowance,
      selectedCost,
      imageAttribution: extra.imageAttribution || "",
      fixtureType: extra.fixtureType || "",
      canonicalType: extra.canonicalType || "",
      swatchHex,
    },
  };
}

function entryFurniture(code, supplier, name, model, handleStyle, handleLength, material, finishes, lockingType, cylinderConfiguration, latchMechanism, backset, compatibleDoorThickness, image, url, verificationStatus) {
  return {
    product_code: `ENTRY-DOOR-FURNITURE-${code}`,
    stable_product_id: `master-entry-door-furniture-${slug(code)}`,
    family_key: "handles",
    requirement_keys: "external-door-furniture;entry-door-furniture;entry-doors",
    category_key: "External Door Furniture",
    top_level_area: "exterior",
    manufacturer: supplier,
    brand: supplier,
    supplier,
    range: handleStyle,
    product_name: name,
    model,
    description: `${name}; ${handleStyle}; finishes ${finishes.join(", ")}.`,
    finish: finishes.join(", "),
    size: handleLength,
    material,
    primary_image_url: image,
    thumbnail_url: image,
    image_source_url: url,
    image_source_type: "legacy_verified_supplier_image",
    image_verified_at: VERIFIED_AT,
    image_status: "verified_exact",
    official_product_url: url,
    specification_url: url,
    supplier_url: url,
    client_price: "",
    currency: "AUD",
    gst_included: true,
    price_unit: "EACH",
    price_status: verificationStatus === "verified_package" ? "price_pending" : "quote_required",
    country: "AU",
    regions: "AU;QLD",
    active: true,
    discontinued: false,
    archived: false,
    source_type: "client_selections_legacy_migration",
    source_name: `${supplier} official product page via Client Selections`,
    source_url: url,
    source_verified_at: VERIFIED_AT,
    attributes: {
      applicableRooms: ["exterior"],
      legacyClientSelectionId: code,
      migratedFromClientSelections: true,
      catalogueOwner: "product-library",
      handleUse: "entry-door",
      choiceType: "entry-door-furniture",
      handleStyle,
      handleLength,
      finishOptions: finishes,
      lockingType,
      cylinderConfiguration,
      latchMechanism,
      backset,
      compatibleDoorThickness,
      verificationStatus,
      quotationMappingId: "approved-family:entry-doors",
    },
  };
}

function glassOption(name, code, classification, privacy, lightTransmission, sampleImage) {
  const productCode = `ENTRY-DOOR-GLASS-HUME-SAVOY-XS26-${slug(code)}`;
  return {
    product_code: productCode,
    stable_product_id: `master-${productCode}`,
    family_key: "entry-doors",
    requirement_keys: "entry-doors;entry-door-glass",
    category_key: "Entry Door Glass Options",
    top_level_area: "exterior",
    manufacturer: "Hume Doors & Timber",
    brand: "Hume Doors & Timber",
    supplier: "Hume Doors & Timber",
    range: "Savoy 1200",
    product_name: `Hume Savoy XS26 ${name} glass option`,
    model: code,
    description: `${classification} glass option for Hume Savoy XS26 entry doors. ${lightTransmission}`,
    colour: name,
    finish: classification,
    material: "Glass",
    primary_image_url: sampleImage,
    thumbnail_url: sampleImage,
    image_source_url: "https://www.humedoors.com.au/ranges/entrance/savoy-1200?model=XS26-1200",
    image_source_type: "legacy_verified_supplier_visual",
    image_verified_at: VERIFIED_AT,
    image_status: "verified_range",
    official_product_url: "https://www.humedoors.com.au/ranges/entrance/savoy-1200?model=XS26-1200",
    specification_url: "https://www.humedoors.com.au/ranges/entrance/savoy-1200?model=XS26-1200",
    currency: "AUD",
    gst_included: true,
    price_unit: "EACH",
    price_status: name === "Clear" ? "allowance_only" : "quote_required",
    country: "AU",
    regions: "AU;QLD",
    active: true,
    discontinued: false,
    archived: false,
    source_type: "client_selections_legacy_migration",
    source_name: "Hume Savoy 1200 glass options from Client Selections",
    source_url: SOURCE_URL,
    source_verified_at: VERIFIED_AT,
    attributes: {
      applicableRooms: ["exterior"],
      legacyClientSelectionId: `hume-savoy-xs26-glass-${slug(code)}`,
      migratedFromClientSelections: true,
      catalogueOwner: "product-library",
      optionType: "entry-door-glass",
      classification,
      privacy,
      lightTransmission,
      quotationMappingId: "approved-family:entry-doors",
    },
  };
}

function colourProduct(id, brand, range, name, code, family, hex, suitability, sourceUrl) {
  const swatchUrl = swatchImage(`${brand} ${name}`, hex);
  return {
    product_code: `EXTERIOR-COLOUR-${slug(id)}`,
    stable_product_id: `master-exterior-colour-${slug(id)}`,
    family_key: "exterior-paint",
    requirement_keys: "exterior-paint",
    category_key: "Exterior Paint Colours",
    top_level_area: "exterior",
    manufacturer: brand,
    brand,
    supplier: brand,
    range,
    product_name: `${brand} ${name}`,
    model: code,
    description: `${name} ${range} colour selection. ${suitability}.`,
    colour: name,
    official_colour_name: name,
    colour_group: family,
    finish: range,
    primary_image_url: swatchUrl,
    thumbnail_url: swatchUrl,
    image_source_url: sourceUrl,
    image_source_type: "colour_swatch",
    image_verified_at: VERIFIED_AT,
    image_status: "verified_exact",
    official_product_url: sourceUrl,
    specification_url: sourceUrl,
    currency: "AUD",
    gst_included: true,
    price_unit: "ITEM",
    price_status: brand === "Builder/Painter" ? "quote_required" : "allowance_only",
    country: "AU",
    regions: "AU;QLD",
    active: true,
    discontinued: false,
    archived: false,
    source_type: "client_selections_legacy_migration",
    source_name: "Exterior colour palette from Client Selections",
    source_url: SOURCE_URL,
    source_verified_at: VERIFIED_AT,
    colourSwatches: [{ name, hex }],
    attributes: {
      applicableRooms: ["exterior"],
      legacyClientSelectionId: id,
      migratedFromClientSelections: true,
      catalogueOwner: "product-library",
      swatchHex: hex,
      colourFamily: family,
      suitability,
      quotationMappingId: "approved-family:exterior-paint",
    },
  };
}

function categoryForFamily(familyKey, fixtureType = "") {
  if (familyKey === "tapware" && fixtureType === "basin") return "Basins";
  if (familyKey === "tapware" && fixtureType === "toilet") return "Toilets";
  if (familyKey === "tapware" && fixtureType === "basin-mixer") return "Basin Mixers";
  if (familyKey === "tiles") return "Tiles";
  if (familyKey === "flooring") return "Flooring";
  if (familyKey === "paint") return "Internal Paint Colours";
  if (familyKey === "cabinetry" && fixtureType === "vanity") return "Vanities";
  if (familyKey === "kitchen-sink-mixers") return "Kitchen Mixers";
  if (familyKey === "kitchen-sinks") return "Kitchen Sinks";
  return familyKey;
}

function topLevelForFamily(familyKey) {
  if (["tapware", "tiles"].includes(familyKey)) return "bathroom-ensuite";
  if (["flooring", "paint", "lighting", "internal-doors"].includes(familyKey)) return "interior";
  if (["cabinetry", "kitchen-sinks", "kitchen-sink-mixers", "ovens", "cooktops", "rangehoods", "dishwashers", "microwaves"].includes(familyKey)) return "kitchen";
  return "exterior";
}

function sizeFromModel(model = "") {
  return String(model || "").match(/\d{3,4}\s?x\s?\d{3,4}|\d{3,4}\s?mm|\d{3,4}/i)?.[0] || "";
}

function swatchImage(label = "Colour swatch", hex = "#cccccc") {
  const safeHex = /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#cccccc";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420" role="img" aria-label="${escapeXml(label)}"><rect width="640" height="420" fill="${safeHex}"/><rect x="24" y="24" width="592" height="372" rx="20" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="2"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeXml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function slug(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
