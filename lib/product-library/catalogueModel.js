export const PRODUCT_LIBRARY_SOURCE_CSV = "C:\\Users\\grant\\Downloads\\PRODUCTS LIBRARY.csv";

export const PRODUCT_LIBRARY_IMPORT_COLUMNS = [
  "product_code",
  "linked_quote_item_code",
  "supplier_name",
  "brand",
  "range",
  "product_name",
  "model",
  "category",
  "subcategory",
  "product_family",
  "colour",
  "finish",
  "size",
  "width",
  "height",
  "depth",
  "variant_name",
  "primary_image",
  "gallery_images",
  "official_product_url",
  "specification_url",
  "rrp",
  "builder_cost",
  "client_price",
  "currency",
  "gst_treatment",
  "price_effective_date",
  "active",
  "discontinued",
];

export const PRODUCT_ENTITY_FIELDS = {
  identity: ["productId", "productCode", "organisationId", "linkedQuoteItemCode", "approvedSourceKey", "familyKey"],
  classification: ["topLevelArea", "category", "subcategory", "productType", "tags", "compatibleAreaTypes"],
  productData: ["productName", "supplier", "brand", "range", "model", "description", "colour", "finish", "size", "dimensions", "variants"],
  media: ["primaryImage", "thumbnail", "galleryImages", "colourSwatches", "imageAltText", "imageSource"],
  links: ["officialProductURL", "specificationURL", "supplierURL"],
  pricing: ["RRP", "builderCost", "clientPrice", "allowance", "upgradePrice", "currency", "gstTreatment", "priceSource", "effectiveDate", "priceStatus"],
  status: ["active", "discontinued", "archived", "unavailable", "imageReviewRequired", "priceReviewRequired"],
};

export const GENERIC_IMAGE_URLS = {
  exterior: "https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=900&q=80",
  interior: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=80",
  kitchen: "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=80",
  bathroom: "https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&w=900&q=80",
  laundry: "https://images.unsplash.com/photo-1626806819282-2c1dc01a5e0c?auto=format&fit=crop&w=900&q=80",
  bedrooms: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=900&q=80",
  living: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80",
  garage: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=900&q=80",
  outdoor: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=80",
  pool: "https://images.unsplash.com/photo-1572331165267-854da2b10ccc?auto=format&fit=crop&w=900&q=80",
  bricks: "https://images.unsplash.com/photo-1615529162924-f8605388461d?auto=format&fit=crop&w=900&q=80",
  roofing: "https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=900&q=80",
  garageDoors: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=900&q=80",
  internalDoors: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
  stoneBenchtops: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=900&q=80",
  ovens: "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=80",
  cooktops: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=900&q=80",
  tapware: "https://images.unsplash.com/photo-1584622781564-1d987f7333c1?auto=format&fit=crop&w=900&q=80",
  toilets: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=900&q=80",
  flooring: "https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=900&q=80",
  paint: "https://images.unsplash.com/photo-1574180566232-aaad1b5b8450?auto=format&fit=crop&w=900&q=80",
};

export const TOP_LEVEL_AREAS = [
  area("exterior", "Exterior", "External envelope, street-facing selections and outdoor finishes.", GENERIC_IMAGE_URLS.exterior),
  area("interior", "Interior", "Internal finishes, fix out, doors, trim, paint and flooring.", GENERIC_IMAGE_URLS.interior),
  area("kitchen", "Kitchen", "Cabinetry, stone, appliances, sinks, tapware and kitchen finishes.", GENERIC_IMAGE_URLS.kitchen),
  area("bathroom-ensuite", "Bathroom & Ensuite", "Wet-area fixtures, tiles, tapware, vanities and accessories.", GENERIC_IMAGE_URLS.bathroom),
  area("laundry", "Laundry", "Laundry cabinetry, tubs, tapware, tiles and finishes.", GENERIC_IMAGE_URLS.laundry),
  area("bedrooms", "Bedrooms", "Bedroom flooring, wardrobes, internal doors, paint and lighting.", GENERIC_IMAGE_URLS.bedrooms),
  area("living-areas", "Living Areas", "Living, dining, media and study finishes.", GENERIC_IMAGE_URLS.living),
  area("garage", "Garage", "Garage doors, motors, internal access and slab/finish options.", GENERIC_IMAGE_URLS.garage),
  area("outdoor-areas", "Outdoor Areas", "Decks, balustrades, patios, external stairs and landscape selections.", GENERIC_IMAGE_URLS.outdoor),
  area("pool", "Pool", "Pool finishes, fencing, coping, surrounds and equipment selections.", GENERIC_IMAGE_URLS.pool),
];

export const PRODUCT_FAMILIES = [
  family({
    familyKey: "stone-benchtops",
    displayName: "Stone Benchtops",
    topLevelArea: "kitchen",
    category: "Benchtops",
    subcategory: "Stone Tops",
    sourceMatchers: ["STONE", "BENCHTOP", "20MM", "40MM"],
    unit: "M2",
    quantityRule: "Measured from kitchen benchtop area or allowance line.",
    requiredAttributes: ["supplier", "brand", "range", "colour", "finish", "thickness"],
    optionalAttributes: ["pattern", "edgeProfile", "slabSize", "supplierURL"],
    supportedVariantTypes: ["range", "colour", "finish", "thickness", "edgeProfile"],
    imageRequirement: "Colour swatch or installed stone benchtop image required.",
    pricingMode: "allowance-plus-upgrade",
    image: GENERIC_IMAGE_URLS.stoneBenchtops,
  }),
  family({
    familyKey: "metal-roofing",
    displayName: "Metal Roof",
    topLevelArea: "exterior",
    category: "Roofing",
    subcategory: "Metal Roofing",
    sourceMatchers: ["COLORBOND ROOFING", "ROOFING IRON", "METAL ROOF", "ROOF SHEETING"],
    unit: "ITEM",
    quantityRule: "Linked to roof material allowance or measured roof area.",
    requiredAttributes: ["supplier", "brand", "material", "profile", "colour"],
    optionalAttributes: ["range", "finish", "gauge", "thickness", "supplierURL"],
    supportedVariantTypes: ["supplier", "brand", "profile", "colour", "finish", "gauge"],
    imageRequirement: "Roof profile image and colour swatch required.",
    pricingMode: "quote-linked-allowance",
    image: GENERIC_IMAGE_URLS.roofing,
  }),
  family({
    familyKey: "bricks",
    displayName: "Bricks",
    topLevelArea: "exterior",
    category: "Bricks",
    subcategory: "Face Bricks",
    sourceMatchers: ["FACE BRICKS", "FACE BRICKWORK", "BRICK"],
    unit: "1000",
    quantityRule: "Per 1000 bricks or linked masonry allowance.",
    requiredAttributes: ["supplier", "brand", "range", "brickName", "colour"],
    optionalAttributes: ["texture", "format", "supplierURL"],
    supportedVariantTypes: ["supplier", "brand", "range", "brickColour", "texture"],
    imageRequirement: "Brick wall image or product swatch required.",
    pricingMode: "rate-per-thousand",
    image: GENERIC_IMAGE_URLS.bricks,
  }),
  family({
    familyKey: "internal-doors",
    displayName: "Internal Doors",
    topLevelArea: "interior",
    category: "Fix Out",
    subcategory: "Internal Doors",
    sourceMatchers: ["INTERNAL DOOR", "DOOR - BUILDERS RANGE", "FLUSH DOOR", "MOULDED PANEL"],
    unit: "EACH",
    quantityRule: "Per door by schedule opening size.",
    requiredAttributes: ["supplier", "brand", "range", "doorDesign", "size", "finish"],
    optionalAttributes: ["construction", "glazing", "fireRating", "acousticRating", "supplierURL"],
    supportedVariantTypes: ["supplier", "brand", "range", "doorDesign", "size", "finish", "glazing"],
    imageRequirement: "Door face image required.",
    pricingMode: "per-item-upgrade",
    image: GENERIC_IMAGE_URLS.internalDoors,
  }),
  familyCard("garage-doors", "Garage Doors", "exterior", "Garage Doors", "Sectional / Roller Doors", GENERIC_IMAGE_URLS.garageDoors, ["GARAGE DOOR"]),
  familyCard("ovens", "Ovens", "kitchen", "Ovens", "Built-in Ovens", GENERIC_IMAGE_URLS.ovens, ["OVEN"]),
  familyCard("cooktops", "Cooktops", "kitchen", "Cooktops", "Gas / Electric / Induction", GENERIC_IMAGE_URLS.cooktops, ["COOKTOP"]),
  familyCard("cabinetry", "Cabinetry", "kitchen", "Cabinetry", "Cabinet Build", GENERIC_IMAGE_URLS.kitchen, ["CABINET"]),
  familyCard("cabinet-finishes", "Cabinet Finishes", "kitchen", "Cabinetry", "Doors and Panels", GENERIC_IMAGE_URLS.paint, ["LAMINATE", "TWO PAC"]),
  familyCard("handles", "Handles", "kitchen", "Cabinetry", "Handles", GENERIC_IMAGE_URLS.tapware, ["HANDLE"]),
  familyCard("splashbacks", "Splashbacks", "kitchen", "Splashbacks", "Kitchen Splashbacks", GENERIC_IMAGE_URLS.flooring, ["SPLASHBACK"]),
  familyCard("sinks", "Sinks", "kitchen", "Sinks", "Kitchen Sinks", GENERIC_IMAGE_URLS.tapware, ["SINK"]),
  familyCard("sink-mixers", "Sink Mixers", "kitchen", "Tapware", "Kitchen Mixers", GENERIC_IMAGE_URLS.tapware, ["SINK MIXER", "KITCHEN TAP"]),
  familyCard("rangehoods", "Rangehoods", "kitchen", "Rangehoods", "Kitchen Exhaust", GENERIC_IMAGE_URLS.kitchen, ["RANGEHOOD"]),
  familyCard("dishwashers", "Dishwashers", "kitchen", "Dishwashers", "Kitchen Appliances", GENERIC_IMAGE_URLS.laundry, ["DISHWASHER"]),
  familyCard("microwaves", "Microwaves", "kitchen", "Microwaves", "Kitchen Appliances", GENERIC_IMAGE_URLS.ovens, ["MICROWAVE"]),
  familyCard("windows", "Windows", "exterior", "Windows", "Residential Windows", GENERIC_IMAGE_URLS.exterior, ["WINDOW"]),
  familyCard("entry-doors", "Entry Doors", "exterior", "Entry Doors", "Front Doors", GENERIC_IMAGE_URLS.internalDoors, ["ENTRY DOOR", "PIVOT DOOR"]),
  familyCard("cladding", "Cladding", "exterior", "Cladding", "External Cladding", GENERIC_IMAGE_URLS.exterior, ["CLADDING", "LINEA", "WEATHER BOARD"]),
  familyCard("balustrades", "Balustrades", "outdoor-areas", "Balustrades", "Deck / Balcony", GENERIC_IMAGE_URLS.outdoor, ["BALUSTRADE"]),
  familyCard("exterior-paint", "Exterior Paint", "exterior", "Paint", "Exterior Colours", GENERIC_IMAGE_URLS.paint, ["EXTERIOR PAINT"]),
  familyCard("external-lighting", "External Lighting", "exterior", "Lighting", "Outdoor Lights", GENERIC_IMAGE_URLS.exterior, ["EXTERNAL LIGHT", "OUTDOOR LIGHT"]),
  familyCard("vanities", "Vanities", "bathroom-ensuite", "Vanities", "Bathroom Vanity Units", GENERIC_IMAGE_URLS.bathroom, ["VANITY"]),
  familyCard("basins", "Basins", "bathroom-ensuite", "Basins", "Bathroom Basins", GENERIC_IMAGE_URLS.bathroom, ["BASIN"]),
  familyCard("basin-mixers", "Basin Mixers", "bathroom-ensuite", "Tapware", "Basin Mixers", GENERIC_IMAGE_URLS.tapware, ["BASIN MIXER", "TAP"]),
  familyCard("toilets", "Toilets", "bathroom-ensuite", "Toilets", "Toilet Suites", GENERIC_IMAGE_URLS.toilets, ["TOILET"]),
  familyCard("floor-tiles", "Floor Tiles", "bathroom-ensuite", "Tiles", "Floor Tiles", GENERIC_IMAGE_URLS.flooring, ["FLOOR TILE"]),
  familyCard("wall-tiles", "Wall Tiles", "bathroom-ensuite", "Tiles", "Wall Tiles", GENERIC_IMAGE_URLS.flooring, ["WALL TILE"]),
  familyCard("paint", "Paint", "interior", "Paint", "Internal Paint", GENERIC_IMAGE_URLS.paint, ["WALL PAINT", "CEILING PAINT"]),
  familyCard("flooring", "Flooring", "interior", "Flooring", "Timber / Carpet / Tile", GENERIC_IMAGE_URLS.flooring, ["FLOORING", "CARPET", "TIMBER"]),
  familyCard("robes", "Robes", "interior", "Robes", "Wardrobe Fitout", GENERIC_IMAGE_URLS.bedrooms, ["ROBE", "WARDROBE"]),
];

export const GENERIC_DEMO_PRODUCTS = [
  demo("demo-stone-white", "stone-benchtops", "Generic Stone Supplier", "Generic Stone", "Essentials", "Generic Stone Range - White", "White", "Honed", "20mm", GENERIC_IMAGE_URLS.stoneBenchtops, ["White", "Light Grey", "Dark Grey"]),
  demo("demo-stone-grey", "stone-benchtops", "Generic Stone Supplier", "Generic Stone", "Essentials", "Generic Stone Range - Light Grey", "Light Grey", "Polished", "20mm", GENERIC_IMAGE_URLS.stoneBenchtops, ["White", "Light Grey", "Dark Grey"]),
  demo("demo-roof-mid", "metal-roofing", "Generic Roofing Supplier", "Generic Metal Roof", "Classic", "Generic Metal Roof - Mid-tone", "Mid-tone", "Satin", "0.42 BMT", GENERIC_IMAGE_URLS.roofing, ["Light", "Mid-tone", "Dark"], { profile: "Corrugated" }),
  demo("demo-roof-dark", "metal-roofing", "Generic Roofing Supplier", "Generic Metal Roof", "Classic", "Generic Metal Roof - Dark", "Dark", "Satin", "0.42 BMT", GENERIC_IMAGE_URLS.roofing, ["Light", "Mid-tone", "Dark"], { profile: "Standing Seam" }),
  demo("demo-brick-light", "bricks", "Generic Brick Supplier", "Generic Brick", "Foundations", "Generic Brick Range - Light", "Light", "Smooth", "Standard", GENERIC_IMAGE_URLS.bricks, ["Light", "Red/Brown", "Charcoal"]),
  demo("demo-brick-charcoal", "bricks", "Generic Brick Supplier", "Generic Brick", "Foundations", "Generic Brick Range - Charcoal", "Charcoal", "Textured", "Standard", GENERIC_IMAGE_URLS.bricks, ["Light", "Red/Brown", "Charcoal"]),
  demo("demo-door-flush", "internal-doors", "Generic Door Supplier", "Generic Internal Door", "Builder", "Generic Internal Door - Flush", "White", "Paint grade", "820 x 2040", GENERIC_IMAGE_URLS.internalDoors, ["Flush", "Moulded Panel", "Glazed"], { doorDesign: "Flush" }),
  demo("demo-door-panel", "internal-doors", "Generic Door Supplier", "Generic Internal Door", "Builder", "Generic Internal Door - Moulded Panel", "White", "Paint grade", "820 x 2040", GENERIC_IMAGE_URLS.internalDoors, ["Flush", "Moulded Panel", "Glazed"], { doorDesign: "Moulded Panel" }),
];

export function familiesForArea(areaKey) {
  return PRODUCT_FAMILIES.filter((familyItem) => familyItem.topLevelArea === areaKey);
}

export function familyByKey(familyKey) {
  return PRODUCT_FAMILIES.find((familyItem) => familyItem.familyKey === familyKey) || null;
}

export function parseApprovedProductLibraryCsv(text) {
  const rows = parseCsvRows(text);
  let currentSection = "";
  const usableRows = [];
  const headingRows = [];
  const blankRows = [];
  const manualReviewRows = [];

  rows.forEach((row, index) => {
    const sourceRow = index + 1;
    const cells = pad(row, 8).map((value) => String(value || "").trim());
    const [code, rawSection, rawCategory, itemDescription, unit, quantity, rate, total] = cells;
    const nonEmpty = cells.filter(Boolean).length;
    const isHeader = code.toUpperCase() === "CODE" || itemDescription.toUpperCase() === "ITEM";
    const isBlank = nonEmpty === 0;
    const isSectionHeading = !isHeader && !itemDescription && rawSection && nonEmpty <= 2;

    if (isBlank) {
      blankRows.push(sourceRow);
      return;
    }
    if (isHeader) {
      currentSection = rawSection || rawCategory || currentSection;
      headingRows.push({ sourceRow, section: currentSection, raw: cells });
      return;
    }
    if (isSectionHeading) {
      currentSection = rawSection || currentSection;
      headingRows.push({ sourceRow, section: currentSection, raw: cells });
      return;
    }
    if (!itemDescription) {
      manualReviewRows.push({ sourceRow, reason: "Missing item description", raw: cells });
      return;
    }

    const section = rawSection || currentSection || "Unsectioned";
    const category = rawCategory || section;
    const normalised = normaliseSourceRow({ sourceRow, code, section, category, itemDescription, unit, quantity, rate, total });
    usableRows.push(normalised);
    if (!normalised.familyKey) {
      manualReviewRows.push({ sourceRow, reason: "No matching product family", raw: cells });
    }
  });

  const descriptions = new Map();
  usableRows.forEach((row) => {
    const key = normaliseText(row.itemDescription);
    descriptions.set(key, [...(descriptions.get(key) || []), row.sourceRow]);
  });
  const duplicateDescriptions = Array.from(descriptions.entries())
    .filter(([, sourceRows]) => sourceRows.length > 1)
    .map(([description, sourceRows]) => ({ description, sourceRows }));

  return {
    totalPhysicalRows: rows.length,
    usableRows,
    headingRows,
    blankRows,
    sectionCount: new Set(headingRows.map((row) => row.section).filter(Boolean)).size,
    rowsWithQuoteItemCodes: usableRows.filter((row) => row.originalQuoteItemCode).length,
    rowsWithoutUsableCodes: usableRows.filter((row) => !row.originalQuoteItemCode).length,
    duplicateDescriptions,
    missingRates: usableRows.filter((row) => row.rate === "" || row.rate === null),
    broadFamilyRows: usableRows.filter((row) => row.isProductFamily),
    manualReviewRows,
  };
}

export function buildApprovedFamilySourceMap(usableRows = []) {
  const map = new Map(PRODUCT_FAMILIES.map((familyItem) => [familyItem.familyKey, []]));
  usableRows.forEach((row) => {
    if (!row.familyKey) return;
    map.set(row.familyKey, [...(map.get(row.familyKey) || []), row]);
  });
  return map;
}

export function productMatchesFamily(product, familyItem) {
  if (!product || !familyItem) return false;
  const metadata = product.metadata || {};
  if (metadata.familyKey === familyItem.familyKey || metadata.productEntity?.familyKey === familyItem.familyKey) return true;
  if (product.familyKey === familyItem.familyKey) return true;
  const haystack = [
    product.quote_structure_item,
    product.source_quote_item_name,
    product.selection_type,
    product.product_name,
    product.category,
    metadata.category,
    metadata.subcategory,
    metadata.product_family,
  ].filter(Boolean).join(" ").toUpperCase();
  return familyItem.sourceMatchers.some((matcher) => haystack.includes(matcher));
}

export function productsForFamily(products = [], familyItem) {
  return products.filter((product) => productMatchesFamily(product, familyItem));
}

export function createProductEntity(input = {}, organisationId = "") {
  const familyItem = familyByKey(input.familyKey || input.product_family || input.productFamily);
  if (!familyItem) throw new Error("A product cannot be activated unless linked to a valid approved product family.");
  const productCode = String(input.product_code || input.productCode || "").trim();
  return {
    productId: input.productId || productCode || "",
    productCode,
    organisationId,
    linkedQuoteItemCode: input.linked_quote_item_code || input.linkedQuoteItemCode || familyItem.linkedQuoteItemCode || "",
    approvedSourceKey: input.approvedSourceKey || familyItem.approvedSourceKey || "",
    familyKey: familyItem.familyKey,
    topLevelArea: familyItem.topLevelArea,
    category: input.category || familyItem.category,
    subcategory: input.subcategory || familyItem.subcategory,
    productType: input.product_type || input.productType || familyItem.displayName,
    tags: splitList(input.tags),
    compatibleAreaTypes: [familyItem.topLevelArea],
    productName: input.product_name || input.productName || "",
    supplier: input.supplier_name || input.supplier || "",
    brand: input.brand || "",
    range: input.range || "",
    model: input.model || "",
    description: input.description || "",
    colour: input.colour || "",
    finish: input.finish || "",
    size: input.size || "",
    dimensions: {
      width: input.width || "",
      height: input.height || "",
      depth: input.depth || "",
    },
    variants: normaliseVariants(input),
    primaryImage: input.primary_image || input.primaryImage || "",
    thumbnail: input.thumbnail || input.primary_image || "",
    galleryImages: splitList(input.gallery_images || input.galleryImages),
    colourSwatches: splitList(input.colour_swatches || input.colourSwatches),
    imageAltText: input.image_alt_text || input.imageAltText || input.product_name || "",
    imageSource: input.image_source || input.imageSource || "",
    officialProductURL: input.official_product_url || input.officialProductURL || "",
    specificationURL: input.specification_url || input.specificationURL || "",
    supplierURL: input.supplier_url || input.supplierURL || "",
    RRP: moneyNumber(input.rrp || input.RRP),
    builderCost: moneyNumber(input.builder_cost || input.builderCost),
    clientPrice: moneyNumber(input.client_price || input.clientPrice),
    allowance: moneyNumber(input.allowance),
    upgradePrice: moneyNumber(input.upgrade_price || input.upgradePrice),
    currency: input.currency || "AUD",
    gstTreatment: input.gst_treatment || input.gstTreatment || "GST inclusive",
    priceSource: input.price_source || input.priceSource || "supplier import",
    effectiveDate: input.price_effective_date || input.effectiveDate || "",
    priceStatus: input.price_status || input.priceStatus || "needs-review",
    active: boolValue(input.active, true),
    discontinued: boolValue(input.discontinued, false),
    archived: boolValue(input.archived, false),
    unavailable: boolValue(input.unavailable, false),
    imageReviewRequired: !(input.primary_image || input.primaryImage),
    priceReviewRequired: !input.client_price && !input.builder_cost && !input.rrp,
  };
}

export function validateProductImportRows(records = [], organisationId = "") {
  const seenCodes = new Set();
  return records.map((record, index) => {
    const errors = [];
    const productCode = String(record.product_code || "").trim();
    const familyKey = String(record.product_family || "").trim();
    const familyItem = familyByKey(familyKey);
    if (!productCode) errors.push("Missing product_code");
    if (productCode && seenCodes.has(productCode)) errors.push("Duplicate product_code in import");
    if (productCode) seenCodes.add(productCode);
    if (!familyItem) errors.push("Invalid or missing product_family");
    if (familyItem && record.linked_quote_item_code && record.linked_quote_item_code !== familyItem.linkedQuoteItemCode && record.linked_quote_item_code !== familyItem.approvedSourceKey) {
      errors.push("linked_quote_item_code does not match the approved family linkage");
    }
    let entity = null;
    if (!errors.length) entity = createProductEntity({ ...record, familyKey }, organisationId);
    return { rowNumber: index + 2, record, entity, action: errors.length ? "error" : "create-or-update", errors };
  });
}

export function selectionQueryForFamily({ areaKey, familyKey }) {
  const familyItem = familyByKey(familyKey);
  if (!familyItem) throw new Error(`Unknown product family: ${familyKey}`);
  if (areaKey && familyItem.topLevelArea !== areaKey) throw new Error(`Family ${familyKey} does not belong to area ${areaKey}`);
  return {
    area: familyItem.topLevelArea,
    familyKey: familyItem.familyKey,
    linkedQuoteItemCode: familyItem.linkedQuoteItemCode || familyItem.approvedSourceKey,
    category: familyItem.category,
    subcategory: familyItem.subcategory,
  };
}

function area(key, displayName, description, image) {
  return { key, displayName, description, image };
}

function familyCard(familyKey, displayName, topLevelArea, category, subcategory, image, sourceMatchers) {
  return family({
    familyKey,
    displayName,
    topLevelArea,
    category,
    subcategory,
    sourceMatchers,
    unit: "",
    quantityRule: "Linked to matching approved selection requirement.",
    requiredAttributes: ["supplier", "brand", "range", "productName"],
    optionalAttributes: ["colour", "finish", "size", "supplierURL", "specificationURL"],
    supportedVariantTypes: ["supplier", "brand", "range", "colour", "finish", "size"],
    imageRequirement: "Generic family image or product image required.",
    pricingMode: "quote-linked-allowance",
    image,
  });
}

function family(config) {
  const approvedSourceKey = `approved-family:${config.familyKey}`;
  return {
    linkedQuoteItemCode: "",
    approvedSourceKey,
    ...config,
  };
}

function demo(productId, familyKey, supplier, brand, range, productName, colour, finish, size, primaryImage, swatches, extra = {}) {
  const familyItem = familyByKeyFromList(familyKey);
  return {
    productId,
    productCode: productId,
    organisationId: "generic-demo",
    linkedQuoteItemCode: familyItem?.linkedQuoteItemCode || familyItem?.approvedSourceKey || "",
    approvedSourceKey: familyItem?.approvedSourceKey || "",
    familyKey,
    topLevelArea: familyItem?.topLevelArea || "",
    category: familyItem?.category || "",
    subcategory: familyItem?.subcategory || "",
    productType: familyItem?.displayName || "",
    tags: ["generic-demo"],
    compatibleAreaTypes: [familyItem?.topLevelArea || ""].filter(Boolean),
    productName,
    supplier,
    brand,
    range,
    model: "Generic demo",
    description: "Clearly labelled generic demonstration product. Replace with organisation supplier data before use commercially.",
    colour,
    finish,
    size,
    dimensions: {},
    variants: swatches.map((name) => ({ variantName: name, colour: name, finish })),
    primaryImage,
    thumbnail: primaryImage,
    galleryImages: [],
    colourSwatches: swatches,
    imageAltText: `${productName} generic image`,
    imageSource: "Generic demonstration image",
    officialProductURL: "",
    specificationURL: "",
    supplierURL: "",
    RRP: 0,
    builderCost: 0,
    clientPrice: 0,
    allowance: 0,
    upgradePrice: 0,
    currency: "AUD",
    gstTreatment: "GST inclusive",
    priceSource: "generic-demo",
    effectiveDate: "",
    priceStatus: "demo-only",
    active: true,
    discontinued: false,
    archived: false,
    unavailable: false,
    imageReviewRequired: false,
    priceReviewRequired: true,
    ...extra,
  };
}

function familyByKeyFromList(familyKey) {
  return PRODUCT_FAMILIES.find((item) => item.familyKey === familyKey);
}

function normaliseSourceRow(row) {
  const haystack = `${row.section} ${row.category} ${row.itemDescription}`.toUpperCase();
  const familyItem = PRODUCT_FAMILIES.find((item) => item.sourceMatchers.some((matcher) => haystack.includes(matcher)));
  const isProductFamily = Boolean(familyItem) || /RANGE|COLOUR|COLORBOND|STONE|BRICK|DOOR|ROOF|OVEN|COOKTOP|PC SUM|ALLOWANCE/i.test(row.itemDescription);
  return {
    ...row,
    originalQuoteItemCode: row.code || "",
    approvedSourceKey: row.code || `csv-row-${row.sourceRow}`,
    familyKey: familyItem?.familyKey || "",
    topLevelArea: familyItem?.topLevelArea || "",
    familyDisplayName: familyItem?.displayName || "",
    isProductFamily,
  };
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted && char === '"' && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === ",") {
      row.push(cell);
      cell = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function pad(row, count) {
  return Array.from({ length: count }, (_, index) => row[index] || "");
}

function normaliseText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function splitList(value) {
  if (Array.isArray(value)) return value;
  return String(value || "").split(/[|;]/).map((item) => item.trim()).filter(Boolean);
}

function normaliseVariants(input) {
  const variantName = input.variant_name || input.variantName || "";
  if (!variantName && !input.colour && !input.finish && !input.size) return [];
  return [{ variantName, colour: input.colour || "", finish: input.finish || "", size: input.size || "" }];
}

function moneyNumber(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const numeric = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function boolValue(value, fallback) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return fallback;
  if (["1", "true", "yes", "y", "active"].includes(text)) return true;
  if (["0", "false", "no", "n", "inactive"].includes(text)) return false;
  return fallback;
}
