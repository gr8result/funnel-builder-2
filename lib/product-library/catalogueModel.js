export const PRODUCT_LIBRARY_SOURCE_CSV = "data/product-library/PRODUCTS-LIBRARY.csv";
export const APPROVED_SELECTIONS_CSV_PATH = PRODUCT_LIBRARY_SOURCE_CSV;

export const PRODUCT_LIBRARY_IMPORT_COLUMNS = [
  "product_code",
  "linked_quote_item_code",
  "supplier_name",
  "brand",
  "range",
  "product_name",
  "model",
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
  productData: ["productName", "supplier", "brand", "range", "model", "description", "colour", "finish", "size", "width", "height", "depth", "dimensions", "variants"],
  media: ["primaryImage", "thumbnail", "galleryImages", "colourSwatches", "imageAltText", "imageSource"],
  links: ["officialProductURL", "specificationURL", "supplierURL"],
  pricing: ["RRP", "builderCost", "clientPrice", "allowance", "upgradePrice", "currency", "gstTreatment", "priceSource", "priceEffectiveDate", "priceStatus"],
  status: ["active", "discontinued", "archived", "unavailable", "imageReviewRequired", "priceReviewRequired"],
};

export const PRODUCT_LIBRARY_SELECTIONS_KEY = "productLibrarySelections";
export const GARAGE_DOOR_SELECTION_KEY = "exterior:garage-doors";

export const GENERIC_IMAGE_URLS = {
  exterior: "https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=900&q=80",
  interior: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=80",
  kitchen: "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=80",
  bathroom: "https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&w=900&q=80",
  laundry: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=900&q=80",
  bedrooms: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=900&q=80",
  living: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=900&q=80",
  garage: "https://images.unsplash.com/photo-1628744876497-eb30460be9f6?auto=format&fit=crop&w=900&q=80",
  outdoor: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80",
  pool: "https://images.unsplash.com/photo-1572331165267-854da2b10ccc?auto=format&fit=crop&w=900&q=80",
  bricks: "https://images.unsplash.com/photo-1615529162924-f8605388461d?auto=format&fit=crop&w=900&q=80",
  featureBricks: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=80",
  cladding: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=900&q=80",
  render: "https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=900&q=80",
  roofing: "https://images.unsplash.com/photo-1632759145351-1d592919f522?auto=format&fit=crop&w=900&q=80",
  roofColour: "https://images.unsplash.com/photo-1508450859948-4e04fabaa4ea?auto=format&fit=crop&w=900&q=80",
  gutters: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=80",
  fascia: "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?auto=format&fit=crop&w=900&q=80",
  windows: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
  entryDoors: "https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=900&q=80",
  externalDoors: "https://images.unsplash.com/photo-1600607687644-c7171b42498b?auto=format&fit=crop&w=900&q=80",
  garageDoors: "https://images.unsplash.com/photo-1628745277862-bc0b2c64f7a3?auto=format&fit=crop&w=900&q=80",
  balustrades: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=80",
  handrails: "https://images.unsplash.com/photo-1523413363574-c30aa1c2a516?auto=format&fit=crop&w=900&q=80",
  exteriorPaint: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=900&q=80",
  externalLighting: "https://images.unsplash.com/photo-1517991104123-1d56a6e81ed9?auto=format&fit=crop&w=900&q=80",
  drivewayFinishes: "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?auto=format&fit=crop&w=900&q=80",
  decking: "https://images.unsplash.com/photo-1591825729269-caeb344f6df2?auto=format&fit=crop&w=900&q=80",
  internalDoors: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
  stoneBenchtops: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=900&q=80",
  cabinetry: "https://images.unsplash.com/photo-1556912173-3bb406ef7e77?auto=format&fit=crop&w=900&q=80",
  cabinetFinish: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=900&q=80",
  handles: "https://images.unsplash.com/photo-1600566752547-33fcd75f5d25?auto=format&fit=crop&w=900&q=80",
  splashback: "https://images.unsplash.com/photo-1556909212-d5b604d0c90d?auto=format&fit=crop&w=900&q=80",
  sink: "https://images.unsplash.com/photo-1556912172-45b7abe8b7e1?auto=format&fit=crop&w=900&q=80",
  ovens: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=900&q=80",
  cooktops: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=900&q=80",
  rangehood: "https://images.unsplash.com/photo-1560185009-5bf9f2849488?auto=format&fit=crop&w=900&q=80",
  dishwasher: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=900&q=80",
  microwave: "https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?auto=format&fit=crop&w=900&q=80",
  tapware: "https://images.unsplash.com/photo-1584622781564-1d987f7333c1?auto=format&fit=crop&w=900&q=80",
  toilets: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=900&q=80",
  flooring: "https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=900&q=80",
  paint: "https://images.unsplash.com/photo-1574180566232-aaad1b5b8450?auto=format&fit=crop&w=900&q=80",
  vanity: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=900&q=80",
  basin: "https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&w=900&q=80",
  showerMixer: "https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=900&q=80",
  showerScreen: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=80",
  bath: "https://images.unsplash.com/photo-1604709177225-055f99402ea3?auto=format&fit=crop&w=900&q=80",
  mirror: "https://images.unsplash.com/photo-1604014237744-629d1f763460?auto=format&fit=crop&w=900&q=80",
  bathroomAccessories: "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=900&q=80",
  tiles: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=900&q=80",
  laundryTub: "https://images.unsplash.com/photo-1626806819282-2c1dc01a5e0c?auto=format&fit=crop&w=900&q=80",
  robes: "https://images.unsplash.com/photo-1558997519-83ea9252edf8?auto=format&fit=crop&w=900&q=80",
  windowFurnishings: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=900&q=80",
  lighting: "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=900&q=80",
  joinery: "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=900&q=80",
  doorMotor: "https://images.unsplash.com/photo-1628744876497-eb30460be9f6?auto=format&fit=crop&w=900&q=80",
  garageFloor: "https://images.unsplash.com/photo-1592609931095-54a2168ae893?auto=format&fit=crop&w=900&q=80",
  patio: "https://images.unsplash.com/photo-1600607688960-e095ff83135c?auto=format&fit=crop&w=900&q=80",
  stairs: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=80",
  poolFinish: "https://images.unsplash.com/photo-1572331165267-854da2b10ccc?auto=format&fit=crop&w=900&q=80",
  coping: "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=900&q=80",
  poolFencing: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
  poolEquipment: "https://images.unsplash.com/photo-1566847438217-76e82d383f84?auto=format&fit=crop&w=900&q=80",
};

export const GENERIC_GARAGE_DOOR_GALLERY = [
  GENERIC_IMAGE_URLS.garageDoors,
  "https://images.unsplash.com/photo-1628744876497-eb30460be9f6?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?auto=format&fit=crop&w=900&q=80",
];

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

export const TAXONOMY_CATEGORY_DEFINITIONS = [
  category("exterior", "Bricks", "Face Bricks", ["FACE BRICK", "BRICKWORK", "BRICK"]),
  category("exterior", "Feature Bricks", "Feature Brickwork", ["FEATURE BRICK"]),
  category("exterior", "Cladding", "External Cladding", ["CLADDING", "WEATHER BOARD", "WALL SHEETING"]),
  category("exterior", "Render", "External Render", ["RENDER"]),
  category("exterior", "Roofing", "Roofing Materials", ["ROOFING", "ROOF TILES", "ROOFING IRON", "ROOF SHEETING"]),
  category("exterior", "Roof Colour", "Roof Colour", ["ROOF COLOUR", "ROOF COLOR", "COLOUR"]),
  category("exterior", "Gutters", "Guttering", ["GUTTER"]),
  category("exterior", "Fascia", "Fascias", ["FASCIA"]),
  category("exterior", "Windows", "Residential Windows", ["WINDOW", "FLYSCREEN"]),
  category("exterior", "Entry Doors", "Front Entry Doors", ["ENTRY DOOR", "PIVOT DOOR", "ENTRANCE SET"]),
  category("exterior", "External Doors", "External Doors", ["EXTERIOR DOOR", "LAUNDRY/GARAGE", "SIDE LIGHT"]),
  category("exterior", "Garage Doors", "Garage Doors", ["GARAGE DOOR", "PANEL LIFT", "ROLL-A-DOOR"]),
  category("exterior", "Balustrades", "External Balustrades", ["BALUSTRADE"]),
  category("exterior", "Handrails", "External Handrails", ["HANDRAIL"]),
  category("exterior", "Exterior Paint", "Exterior Paint", ["EXTERIOR PAINT", "EXTERNAL PAINT"]),
  category("exterior", "External Lighting", "Outdoor Lighting", ["EXTERNAL LIGHT", "OUTDOOR LIGHT", "LIGHTING"]),
  category("exterior", "Driveway Finishes", "Driveway", ["DRIVEWAY", "CONCRETE FINISH"]),
  category("exterior", "Decking", "Decking", ["DECKING", "DECKS", "BALCONIES"]),

  category("interior", "Internal Doors", "Fix Out / Interior", ["INTERNAL DOOR", "DOOR - BUILDERS RANGE", "FLUSH DOOR", "MOULDED PANEL"]),
  category("interior", "Door Hardware", "Door Hardware", ["DOOR FURNITURE", "HANDLE", "PRIVACY SET", "PASSAGE SET"]),
  category("interior", "Skirting", "Skirting", ["SKIRTING"]),
  category("interior", "Architraves", "Architraves", ["ARCHITRAVE"]),
  category("interior", "Paint", "Internal Paint", ["INTERNAL PAINT", "WALL PAINT", "CEILING PAINT"]),
  category("interior", "Flooring", "Internal Flooring", ["FLOORING", "CARPET", "TIMBER FLOOR", "VINYL", "HYBRID"]),
  category("interior", "Robes", "Wardrobe Fitout", ["ROBE", "WARDROBE"]),
  category("interior", "Window Furnishings", "Window Furnishings", ["CURTAIN", "BLIND", "SHUTTER"]),

  category("kitchen", "Cabinetry", "Kitchen Cabinetry", ["KITCHEN CABINET", "CABINETRY", "CUPBOARD"]),
  category("kitchen", "Cabinet Finish", "Doors and Panels", ["LAMINATE", "TWO PAC", "CABINET FINISH"]),
  category("kitchen", "Handles", "Cabinet Handles", ["HANDLE"]),
  category("kitchen", "Benchtops", "Stone Tops", ["BENCHTOP", "STONE", "20MM", "40MM"]),
  category("kitchen", "Splashback", "Splashback", ["SPLASHBACK"]),
  category("kitchen", "Sink", "Kitchen Sink", ["SINK"]),
  category("kitchen", "Sink Mixer", "Kitchen Mixer", ["SINK MIXER", "KITCHEN TAP", "MIXER"]),
  category("kitchen", "Ovens", "Built-in Oven", ["OVEN"]),
  category("kitchen", "Cooktop", "Cooktop", ["COOKTOP", "HOT PLATE"]),
  category("kitchen", "Rangehood", "Rangehood", ["RANGEHOOD"]),
  category("kitchen", "Dishwasher", "Dishwasher", ["DISHWASHER"]),
  category("kitchen", "Microwave", "Microwave", ["MICROWAVE"]),
  category("kitchen", "Flooring", "Kitchen Flooring", ["FLOOR TILE", "FLOORING"]),
  category("kitchen", "Lighting", "Kitchen Lighting", ["KITCHEN LIGHT", "LIGHTING"]),
  category("kitchen", "Paint", "Kitchen Paint", ["PAINT"]),

  category("bathroom-ensuite", "Vanity", "Vanity", ["VANITY"]),
  category("bathroom-ensuite", "Basin", "Basin", ["BASIN"]),
  category("bathroom-ensuite", "Tapware", "Mixers and Outlets", ["MIXER", "TAP", "SHOWER OUTLET", "SHOWER ROSE", "SHOWER HEAD"]),
  category("bathroom-ensuite", "Basin Mixer", "Basin Mixer", ["BASIN MIXER"]),
  category("bathroom-ensuite", "Shower Mixer", "Shower Mixer", ["SHOWER MIXER"]),
  category("bathroom-ensuite", "Shower Outlet", "Shower Outlet", ["SHOWER OUTLET", "SHOWER ROSE", "SHOWER HEAD"]),
  category("bathroom-ensuite", "Shower Screen", "Shower Screen", ["SHOWER SCREEN"]),
  category("bathroom-ensuite", "Bath", "Bath", ["BATH"]),
  category("bathroom-ensuite", "Toilet", "Toilet Suite", ["TOILET"]),
  category("bathroom-ensuite", "Mirror", "Mirror", ["MIRROR"]),
  category("bathroom-ensuite", "Accessories", "Bathroom Accessories", ["TOWEL", "TOILET ROLL", "SOAP", "ACCESSORIES"]),
  category("bathroom-ensuite", "Floor Tiles", "Floor Tiles", ["FLOOR TILE"]),
  category("bathroom-ensuite", "Wall Tiles", "Wall Tiles", ["WALL TILE"]),
  category("bathroom-ensuite", "Feature Tiles", "Feature Tiles", ["FEATURE TILE"]),

  category("laundry", "Cabinetry", "Laundry Cabinetry", ["LAUNDRY CABINET", "LAUNDRY CUPBOARD"]),
  category("laundry", "Tub", "Laundry Tub", ["LAUNDRY TUB", "TROUGH"]),
  category("laundry", "Tapware", "Laundry Tapware", ["LAUNDRY TAP", "MIXER"]),
  category("laundry", "Tiles", "Laundry Tiles", ["LAUNDRY TILE", "FLOOR TILE", "WALL TILE"]),
  category("laundry", "Benchtops", "Laundry Benchtops", ["LAUNDRY BENCHTOP", "STONE"]),

  category("bedrooms", "Robes", "Bedroom Robes", ["ROBE", "WARDROBE"]),
  category("bedrooms", "Flooring", "Bedroom Flooring", ["CARPET", "FLOORING"]),
  category("bedrooms", "Paint", "Bedroom Paint", ["PAINT"]),
  category("bedrooms", "Lighting", "Bedroom Lighting", ["LIGHT"]),

  category("living-areas", "Flooring", "Living Area Flooring", ["FLOORING", "CARPET", "TIMBER FLOOR", "VINYL", "HYBRID"]),
  category("living-areas", "Paint", "Living Area Paint", ["PAINT"]),
  category("living-areas", "Lighting", "Living Area Lighting", ["LIGHTING", "LIGHT"]),
  category("living-areas", "Joinery", "Living Area Joinery", ["JOINERY", "CABINETRY"]),

  category("garage", "Garage Doors", "Garage Doors", ["GARAGE DOOR", "PANEL LIFT", "ROLL-A-DOOR"]),
  category("garage", "Door Motor", "Garage Door Motor", ["REMOTE OPENER", "MOTOR"]),
  category("garage", "Internal Access", "Internal Access Door", ["GARAGE 820", "INTERNAL ACCESS"]),
  category("garage", "Floor Finish", "Garage Floor Finish", ["GARAGE FLOOR", "EPOXY"]),

  category("outdoor-areas", "Decking", "Decking", ["DECKING", "DECKS", "BALCONIES"]),
  category("outdoor-areas", "Balustrades", "Outdoor Balustrades", ["BALUSTRADE"]),
  category("outdoor-areas", "Patio", "Patio", ["PATIO", "ALFRESCO"]),
  category("outdoor-areas", "Stairs", "External Stairs", ["EXTERIOR STAIRS", "STAIRS"]),
  category("outdoor-areas", "Handrails", "Handrails", ["HANDRAIL"]),
  category("outdoor-areas", "Lighting", "Outdoor Lighting", ["OUTDOOR LIGHT", "EXTERNAL LIGHT"]),

  category("pool", "Pool Finish", "Pool Finish", ["POOL FINISH", "POOL TILE", "INTERIOR FINISH"]),
  category("pool", "Coping", "Pool Coping", ["COPING"]),
  category("pool", "Fencing", "Pool Fencing", ["POOL FENCE", "FENCING"]),
  category("pool", "Surrounds", "Pool Surrounds", ["POOL SURROUND", "PAVING"]),
  category("pool", "Equipment", "Pool Equipment", ["POOL PUMP", "FILTER", "CHLORINATOR"]),
];

const BASE_PRODUCT_FAMILIES = [
  family({
    familyKey: "stone-20mm-tops",
    displayName: "20mm Stone Tops",
    topLevelArea: "kitchen",
    category: "Benchtops",
    subcategory: "Stone Tops",
    sourceMatchers: ["20MM", "STONE", "BENCHTOP"],
    unit: "M2",
    quantityRule: "Measured from kitchen benchtop area or linked allowance row.",
    requiredAttributes: ["supplier", "brand", "range", "colour", "finish", "thickness"],
    optionalAttributes: ["edgeProfile", "image", "price", "supplierURL", "supplierUrl", "specificationURL"],
    supportedVariantTypes: ["range", "colour", "finish", "thickness", "edgeProfile"],
    imageRequirement: "Stone swatch or installed benchtop image required.",
    pricingMode: "allowance-plus-upgrade",
    image: GENERIC_IMAGE_URLS.stoneBenchtops,
  }),
  family({
    familyKey: "stone-40mm-tops",
    displayName: "40mm Stone Tops",
    topLevelArea: "kitchen",
    category: "Benchtops",
    subcategory: "Stone Tops",
    sourceMatchers: ["40MM", "STONE", "BENCHTOP"],
    unit: "M2",
    quantityRule: "Measured from kitchen benchtop area or linked allowance row.",
    requiredAttributes: ["supplier", "brand", "range", "colour", "finish", "thickness"],
    optionalAttributes: ["edgeProfile", "image", "price", "supplierURL", "supplierUrl", "specificationURL"],
    supportedVariantTypes: ["range", "colour", "finish", "thickness", "edgeProfile"],
    imageRequirement: "Stone swatch or installed benchtop image required.",
    pricingMode: "allowance-plus-upgrade",
    image: GENERIC_IMAGE_URLS.stoneBenchtops,
  }),
  family({
    familyKey: "stone-benchtops",
    displayName: "Stone Benchtops",
    topLevelArea: "kitchen",
    category: "Benchtops",
    subcategory: "Stone Tops",
    sourceMatchers: ["STONE", "BENCHTOP", "20MM", "40MM"],
    unit: "M2",
    quantityRule: "Measured from kitchen benchtop area or linked allowance row.",
    requiredAttributes: ["supplier", "brand", "range", "colour", "finish", "thickness"],
    optionalAttributes: ["edgeProfile", "image", "price", "supplierURL", "supplierUrl", "specificationURL"],
    supportedVariantTypes: ["range", "colour", "finish", "thickness", "edgeProfile"],
    imageRequirement: "Stone swatch or installed benchtop image required.",
    pricingMode: "allowance-plus-upgrade",
    image: GENERIC_IMAGE_URLS.stoneBenchtops,
  }),
  family({
    familyKey: "bricks",
    displayName: "Bricks",
    topLevelArea: "exterior",
    category: "Bricks",
    subcategory: "Face Bricks",
    sourceMatchers: ["FACE BRICK", "BRICKWORK", "BRICK"],
    unit: "1000",
    quantityRule: "Per 1000 bricks or linked masonry allowance.",
    requiredAttributes: ["supplier", "brand", "range", "brickName", "colour"],
    optionalAttributes: ["texture", "format", "image", "price", "supplierURL", "supplierUrl", "specificationURL"],
    supportedVariantTypes: ["range", "brickName", "colour", "texture", "format"],
    imageRequirement: "Brick wall image or product swatch required.",
    pricingMode: "rate-per-thousand",
    image: GENERIC_IMAGE_URLS.bricks,
  }),
  family({
    familyKey: "metal-roofing",
    displayName: "Metal Roofing",
    topLevelArea: "exterior",
    category: "Roofing",
    subcategory: "Metal Roofing",
    sourceMatchers: ["ROOFING IRON", "METAL ROOF", "ROOF SHEETING", "ROOFING MATERIALS"],
    unit: "ITEM",
    quantityRule: "Linked to roof material allowance or measured roof area.",
    requiredAttributes: ["supplier", "brand", "profile", "range", "colour"],
    optionalAttributes: ["finish", "gauge", "image", "price", "supplierURL", "supplierUrl", "specificationURL"],
    supportedVariantTypes: ["profile", "range", "colour", "finish", "gauge"],
    imageRequirement: "Roof profile image and colour swatch required.",
    pricingMode: "quote-linked-allowance",
    image: GENERIC_IMAGE_URLS.roofing,
  }),
  family({
    familyKey: "garage-doors",
    displayName: "Garage Doors",
    topLevelArea: "exterior",
    category: "Garage Doors",
    subcategory: "Sectional / Roller Doors",
    sourceMatchers: ["GARAGE DOOR", "PANEL LIFT", "ROLL-A-DOOR"],
    unit: "ITEM",
    quantityRule: "Per garage opening by door type and size.",
    requiredAttributes: ["supplier", "brand", "range", "design", "size", "finish"],
    optionalAttributes: ["colour", "operation", "motor", "image", "price", "supplierURL", "supplierUrl"],
    supportedVariantTypes: ["range", "design", "size", "colour", "finish", "operation"],
    imageRequirement: "Garage door image required.",
    pricingMode: "per-item-upgrade",
    image: GENERIC_IMAGE_URLS.garageDoors,
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
    requiredAttributes: ["supplier", "brand", "range", "design", "construction", "size", "finish"],
    optionalAttributes: ["glazing", "image", "price", "supplierURL", "supplierUrl", "fireRating", "acousticRating"],
    supportedVariantTypes: ["range", "design", "construction", "size", "finish", "glazing"],
    imageRequirement: "Door face image required.",
    pricingMode: "per-item-upgrade",
    image: GENERIC_IMAGE_URLS.internalDoors,
  }),
  family({
    familyKey: "ovens",
    displayName: "Ovens",
    topLevelArea: "kitchen",
    category: "Ovens",
    subcategory: "Built-in Oven",
    sourceMatchers: ["OVEN"],
    unit: "EACH",
    quantityRule: "Per appliance selection.",
    requiredAttributes: ["supplier", "brand", "range", "model", "size"],
    optionalAttributes: ["finish", "capacity", "fuelType", "image", "price", "supplierURL", "supplierUrl", "specificationURL"],
    supportedVariantTypes: ["brand", "range", "model", "size", "finish", "fuelType"],
    imageRequirement: "Appliance image required.",
    pricingMode: "per-item-upgrade",
    image: GENERIC_IMAGE_URLS.ovens,
  }),
  family({
    familyKey: "tapware",
    displayName: "Tapware",
    topLevelArea: "bathroom-ensuite",
    category: "Tapware",
    subcategory: "Mixers and Outlets",
    sourceMatchers: ["MIXER", "TAP", "SHOWER OUTLET", "SHOWER ROSE", "SHOWER HEAD"],
    unit: "EACH",
    quantityRule: "Per fixture point.",
    requiredAttributes: ["supplier", "brand", "range", "model", "finish"],
    optionalAttributes: ["colour", "welsRating", "image", "price", "supplierURL", "supplierUrl", "specificationURL"],
    supportedVariantTypes: ["range", "model", "finish", "colour", "welsRating"],
    imageRequirement: "Tapware product image required.",
    pricingMode: "per-item-upgrade",
    image: GENERIC_IMAGE_URLS.tapware,
  }),
  family({
    familyKey: "tiles",
    displayName: "Tiles",
    topLevelArea: "bathroom-ensuite",
    category: "Tiles",
    subcategory: "Floor / Wall / Feature Tiles",
    sourceMatchers: ["TILE", "TILES"],
    unit: "M2",
    quantityRule: "Measured by tiled surface area.",
    requiredAttributes: ["supplier", "brand", "range", "tileName", "colour", "finish", "format"],
    optionalAttributes: ["texture", "slipRating", "image", "price", "supplierURL", "supplierUrl"],
    supportedVariantTypes: ["range", "tileName", "colour", "finish", "format", "texture"],
    imageRequirement: "Tile swatch or installed tile image required.",
    pricingMode: "rate-per-square-metre",
    image: GENERIC_IMAGE_URLS.flooring,
  }),
  family({
    familyKey: "flooring",
    displayName: "Flooring",
    topLevelArea: "interior",
    category: "Flooring",
    subcategory: "Timber / Carpet / Tile",
    sourceMatchers: ["FLOORING", "CARPET", "TIMBER FLOOR", "VINYL", "HYBRID"],
    unit: "M2",
    quantityRule: "Measured by finished floor area.",
    requiredAttributes: ["supplier", "brand", "range", "productName", "colour", "finish"],
    optionalAttributes: ["material", "format", "thickness", "image", "price", "supplierURL", "supplierUrl", "specificationURL"],
    supportedVariantTypes: ["range", "productName", "material", "colour", "finish", "format", "thickness"],
    imageRequirement: "Flooring product or installed finish image required.",
    pricingMode: "rate-per-square-metre",
    image: GENERIC_IMAGE_URLS.flooring,
  }),
];

export const PRODUCT_FAMILIES = BASE_PRODUCT_FAMILIES;
export const GENERIC_DEMO_PRODUCTS = [];

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
      currentSection = titleCase(rawSection || rawCategory || currentSection);
      headingRows.push({ sourceRow, section: currentSection, raw: cells });
      return;
    }
    if (isSectionHeading) {
      currentSection = titleCase(rawSection || currentSection);
      headingRows.push({ sourceRow, section: currentSection, raw: cells });
      return;
    }
    if (!itemDescription) {
      manualReviewRows.push({ sourceRow, reason: "Missing item description", raw: cells });
      return;
    }

    const section = currentSection || titleCase(rawSection) || "Unsectioned";
    const categoryName = titleCase(rawSection || section);
    const subcategoryName = titleCase(rawCategory || categoryName);
    const normalised = normaliseSourceRow({
      sourceRow,
      originalQuoteItemCode: code,
      section,
      category: categoryName,
      subcategory: subcategoryName,
      itemDescription,
      unit,
      quantity,
      rate,
      total,
    });
    usableRows.push(normalised);
    if (!normalised.familyKey && !normalised.selectionCategory) {
      manualReviewRows.push({ sourceRow, reason: "No matching product family or taxonomy category", raw: cells });
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
    sourcePath: PRODUCT_LIBRARY_SOURCE_CSV,
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

export function buildProductLibraryTaxonomy(usableRows = []) {
  return {
    sourcePath: PRODUCT_LIBRARY_SOURCE_CSV,
    areas: TOP_LEVEL_AREAS.map((areaItem) => {
      const definitions = TAXONOMY_CATEGORY_DEFINITIONS.filter((definition) => definition.topLevelArea === areaItem.key);
      return {
        ...areaItem,
        categories: definitions.map((definition) => {
          const sourceRows = usableRows.filter((row) => row.selectionArea === definition.topLevelArea && row.selectionCategory === definition.category);
          return {
            key: definition.key,
            displayName: definition.category,
            category: definition.category,
            subcategory: definition.subcategory,
            topLevelArea: definition.topLevelArea,
            image: definition.image,
            sourceRows,
            sourceRowCount: sourceRows.length,
          };
        }),
      };
    }),
  };
}

export function buildProductFamilyDefinitions(usableRows = []) {
  return PRODUCT_FAMILIES.map((familyItem) => {
    const sourceRows = usableRows.filter((row) => row.familyKey === familyItem.familyKey || sourceRowMatchesFamily(row, familyItem));
    const quoteCode = sourceRows.find((row) => row.originalQuoteItemCode)?.originalQuoteItemCode || familyItem.linkedQuoteItemCode || "";
    const unit = familyItem.unit || sourceRows.find((row) => row.unit)?.unit || "";
    return {
      ...familyItem,
      linkedQuoteItemCode: quoteCode,
      unit,
      sourceRows,
      sourceRowCount: sourceRows.length,
      approvedSourceKeys: sourceRows.map((row) => row.approvedSourceKey),
    };
  });
}

export function buildApprovedFamilySourceMap(usableRows = []) {
  const map = new Map(PRODUCT_FAMILIES.map((familyItem) => [familyItem.familyKey, []]));
  usableRows.forEach((row) => {
    if (!row.familyKey) return;
    map.set(row.familyKey, [...(map.get(row.familyKey) || []), row]);
  });
  return map;
}

export function familiesForArea(areaKey) {
  return PRODUCT_FAMILIES.filter((familyItem) => familyItem.topLevelArea === areaKey);
}

export function familyByKey(familyKey) {
  return PRODUCT_FAMILIES.find((familyItem) => familyItem.familyKey === familyKey) || null;
}

export function productMatchesFamily(product, familyItem) {
  if (!product || !familyItem) return false;
  const metadata = product.metadata || {};
  const explicitFamilyKey = metadata.familyKey || metadata.productEntity?.familyKey || product.familyKey;
  if (explicitFamilyKey) return explicitFamilyKey === familyItem.familyKey;
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

export function demoGarageDoorProducts(organisationId = "demo-organisation") {
  return [
    createProductEntity({
      product_code: "DEMO-GARAGE-SECTIONAL-WHITE",
      linked_quote_item_code: "approved-family:garage-doors",
      product_family: "garage-doors",
      supplier_name: "Generic Demonstration Supplier",
      brand: "Generic Demonstration Brand",
      range: "Sectional Door Demonstration Range",
      product_name: "Generic Demonstration Sectional Garage Door",
      model: "DEMO-SECTIONAL-4800",
      description: "Clearly labelled demonstration product for testing Garage Door selections when no organisation catalogue products exist.",
      colour: "Classic white",
      finish: "Textured steel-look finish",
      size: "4800mm x 2100mm",
      width: "4800mm",
      height: "2100mm",
      variant_name: "Double sectional door",
      primary_image: GENERIC_IMAGE_URLS.garageDoors,
      gallery_images: GENERIC_GARAGE_DOOR_GALLERY.join("|"),
      official_product_url: "https://example.com/demo-garage-door",
      specification_url: "https://example.com/demo-garage-door-specification",
      currency: "AUD",
      gst_treatment: "GST not priced",
      price_status: "Demonstration only - price not set",
      active: "true",
      discontinued: "false",
    }, organisationId),
    createProductEntity({
      product_code: "DEMO-GARAGE-ROLLER-CHARCOAL",
      linked_quote_item_code: "approved-family:garage-doors",
      product_family: "garage-doors",
      supplier_name: "Generic Demonstration Supplier",
      brand: "Generic Demonstration Brand",
      range: "Roller Door Demonstration Range",
      product_name: "Generic Demonstration Roller Garage Door",
      model: "DEMO-ROLLER-2400",
      description: "Clearly labelled demonstration product for testing single Garage Door selections without inventing real supplier or pricing data.",
      colour: "Charcoal",
      finish: "Ribbed metal-look finish",
      size: "2400mm x 2100mm",
      width: "2400mm",
      height: "2100mm",
      variant_name: "Single roller door",
      primary_image: GENERIC_IMAGE_URLS.garageDoors,
      gallery_images: GENERIC_GARAGE_DOOR_GALLERY.join("|"),
      official_product_url: "https://example.com/demo-roller-garage-door",
      specification_url: "https://example.com/demo-roller-garage-door-specification",
      currency: "AUD",
      gst_treatment: "GST not priced",
      price_status: "Demonstration only - price not set",
      active: "true",
      discontinued: "false",
    }, organisationId),
  ];
}

export function productsForGarageDoors(products = [], organisationId = "demo-organisation") {
  const familyItem = familyByKey("garage-doors");
  const actualProducts = productsForFamily(products, familyItem).filter((product) => product.topLevelArea === "exterior" || product.category === "Garage Doors");
  return actualProducts.length ? actualProducts : demoGarageDoorProducts(organisationId);
}

export function selectionKeyForFamily(familyItem) {
  if (!familyItem) return "";
  return `${familyItem.topLevelArea}:${familyItem.familyKey}`;
}

export function createSelectionFromProduct(product, familyItem, variant = null) {
  if (!product || !familyItem) throw new Error("A product and family are required to create a selection.");
  return {
    selectionKey: selectionKeyForFamily(familyItem),
    area: familyItem.topLevelArea,
    category: familyItem.category,
    subcategory: familyItem.subcategory,
    familyKey: familyItem.familyKey,
    linkedQuoteItemCode: product.linkedQuoteItemCode || familyItem.linkedQuoteItemCode || familyItem.approvedSourceKey,
    productId: product.productId || "",
    productCode: product.productCode || "",
    productName: product.productName || "",
    supplier: product.supplier || "",
    brand: product.brand || "",
    range: product.range || "",
    model: product.model || "",
    size: variant?.size || product.size || "",
    colour: variant?.colour || product.colour || "",
    finish: variant?.finish || product.finish || "",
    primaryImage: product.primaryImage || "",
    price: product.clientPrice || product.builderCost || product.RRP || 0,
    allowance: product.allowance || product.builderCost || 0,
    variation: product.upgradePrice || product.clientPrice || 0,
    priceStatus: product.priceStatus || (product.priceReviewRequired ? "Price not set" : "Priced"),
    selectedVariant: variant || product.variants?.[0] || null,
    selectedAt: new Date().toISOString(),
  };
}

export function productLibrarySelectionsFromJobFile(jobFile = {}) {
  const workbookSelections = jobFile?.workbook?.[PRODUCT_LIBRARY_SELECTIONS_KEY];
  const rootSelections = jobFile?.[PRODUCT_LIBRARY_SELECTIONS_KEY];
  const selections = workbookSelections || rootSelections || {};
  return selections && typeof selections === "object" && !Array.isArray(selections) ? selections : {};
}

export function writeProductLibrarySelectionToJobFile(jobFile = {}, selection) {
  if (!selection?.selectionKey) throw new Error("A selection key is required.");
  const currentSelections = productLibrarySelectionsFromJobFile(jobFile);
  const nextSelections = { ...currentSelections, [selection.selectionKey]: selection };
  return {
    ...jobFile,
    [PRODUCT_LIBRARY_SELECTIONS_KEY]: nextSelections,
    workbook: {
      ...(jobFile.workbook || {}),
      [PRODUCT_LIBRARY_SELECTIONS_KEY]: nextSelections,
    },
  };
}

export function createProductEntity(input = {}, organisationId = "") {
  const familyItem = familyByKey(input.familyKey || input.product_family || input.productFamily);
  if (!familyItem) throw new Error("A product cannot be activated unless linked to a valid approved product family.");
  const productCode = String(input.product_code || input.productCode || "").trim();
  const width = input.width || input.dimensions?.width || "";
  const height = input.height || input.dimensions?.height || "";
  const depth = input.depth || input.dimensions?.depth || "";
  return {
    productId: input.productId || productCode || "",
    productCode,
    organisationId,
    linkedQuoteItemCode: input.linked_quote_item_code || input.linkedQuoteItemCode || familyItem.linkedQuoteItemCode || familyItem.approvedSourceKey || "",
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
    width,
    height,
    depth,
    dimensions: {
      width,
      height,
      depth,
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
    priceEffectiveDate: input.price_effective_date || input.priceEffectiveDate || input.effectiveDate || "",
    effectiveDate: input.price_effective_date || input.priceEffectiveDate || input.effectiveDate || "",
    priceStatus: input.price_status || input.priceStatus || "needs-review",
    active: boolValue(input.active, true),
    discontinued: boolValue(input.discontinued, false),
    archived: boolValue(input.archived, false),
    unavailable: boolValue(input.unavailable, false),
    imageReviewRequired: !(input.primary_image || input.primaryImage),
    priceReviewRequired: !input.client_price && !input.builder_cost && !input.rrp,
  };
}

export function validateProductImportRows(records = [], organisationId = "", existingProducts = []) {
  return previewProductImportRows(records, { organisationId, existingProducts });
}

export function previewProductImportRows(records = [], { organisationId = "", existingProducts = [] } = {}) {
  const seenCodes = new Set();
  const existingByCode = new Map(existingProducts.map((product) => [normaliseText(product.productCode || product.product_code || product.sku), product]).filter(([key]) => key));
  return records.map((record, index) => {
    const errors = [];
    const productCode = String(record.product_code || "").trim();
    const familyKey = String(record.product_family || "").trim();
    const familyItem = familyByKey(familyKey);
    const existing = existingByCode.get(normaliseText(productCode)) || null;
    if (!productCode) errors.push("Missing product_code");
    if (productCode && seenCodes.has(normaliseText(productCode))) errors.push("Duplicate product_code in import");
    if (productCode) seenCodes.add(normaliseText(productCode));
    if (!familyItem) errors.push("Invalid or missing product_family");
    if (familyItem && record.linked_quote_item_code && record.linked_quote_item_code !== familyItem.linkedQuoteItemCode && record.linked_quote_item_code !== familyItem.approvedSourceKey) {
      errors.push("linked_quote_item_code does not match the approved family linkage");
    }
    ["primary_image", "official_product_url", "specification_url", "supplier_url"].forEach((field) => {
      if (record[field] && !isValidUrl(record[field])) errors.push(`Invalid ${field} URL`);
    });
    let entity = null;
    if (!errors.length) entity = createProductEntity({ ...record, familyKey }, organisationId);
    const unchanged = entity && existing ? productEntityComparable(entity) === productEntityComparable(existing.metadata?.productEntity || existing) : false;
    const action = errors.length ? "error" : existing ? (unchanged ? "skip-unchanged" : "update") : "create";
    return {
      rowNumber: index + 2,
      record,
      entity,
      existingProductId: existing?.productId || existing?.id || "",
      action,
      familyMapping: familyItem ? { familyKey: familyItem.familyKey, displayName: familyItem.displayName } : null,
      quoteItemMapping: familyItem ? record.linked_quote_item_code || familyItem.linkedQuoteItemCode || familyItem.approvedSourceKey : "",
      imagePreview: record.primary_image || "",
      errors,
    };
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

function category(topLevelArea, categoryName, subcategory, sourceMatchers) {
  return {
    key: slug(`${topLevelArea}-${categoryName}`),
    topLevelArea,
    category: categoryName,
    subcategory,
    sourceMatchers,
    image: imageForCategory(topLevelArea, categoryName),
  };
}

function imageForCategory(topLevelArea, categoryName) {
  const key = slug(categoryName);
  const byCategory = {
    bricks: GENERIC_IMAGE_URLS.bricks,
    "feature-bricks": GENERIC_IMAGE_URLS.featureBricks,
    cladding: GENERIC_IMAGE_URLS.cladding,
    render: GENERIC_IMAGE_URLS.render,
    roofing: GENERIC_IMAGE_URLS.roofing,
    "roof-colour": GENERIC_IMAGE_URLS.roofColour,
    gutters: GENERIC_IMAGE_URLS.gutters,
    fascia: GENERIC_IMAGE_URLS.fascia,
    windows: GENERIC_IMAGE_URLS.windows,
    "entry-doors": GENERIC_IMAGE_URLS.entryDoors,
    "external-doors": GENERIC_IMAGE_URLS.externalDoors,
    "garage-doors": GENERIC_IMAGE_URLS.garageDoors,
    balustrades: GENERIC_IMAGE_URLS.balustrades,
    handrails: GENERIC_IMAGE_URLS.handrails,
    "exterior-paint": GENERIC_IMAGE_URLS.exteriorPaint,
    "external-lighting": GENERIC_IMAGE_URLS.externalLighting,
    "driveway-finishes": GENERIC_IMAGE_URLS.drivewayFinishes,
    decking: GENERIC_IMAGE_URLS.decking,
    "internal-doors": GENERIC_IMAGE_URLS.internalDoors,
    "door-hardware": GENERIC_IMAGE_URLS.handles,
    skirting: GENERIC_IMAGE_URLS.internalDoors,
    architraves: GENERIC_IMAGE_URLS.fascia,
    paint: GENERIC_IMAGE_URLS.paint,
    flooring: GENERIC_IMAGE_URLS.flooring,
    robes: GENERIC_IMAGE_URLS.robes,
    "window-furnishings": GENERIC_IMAGE_URLS.windowFurnishings,
    cabinetry: GENERIC_IMAGE_URLS.cabinetry,
    "cabinet-finish": GENERIC_IMAGE_URLS.cabinetFinish,
    handles: GENERIC_IMAGE_URLS.handles,
    benchtops: GENERIC_IMAGE_URLS.stoneBenchtops,
    splashback: GENERIC_IMAGE_URLS.splashback,
    sink: GENERIC_IMAGE_URLS.sink,
    "sink-mixer": GENERIC_IMAGE_URLS.tapware,
    oven: GENERIC_IMAGE_URLS.ovens,
    ovens: GENERIC_IMAGE_URLS.ovens,
    cooktop: GENERIC_IMAGE_URLS.cooktops,
    rangehood: GENERIC_IMAGE_URLS.rangehood,
    dishwasher: GENERIC_IMAGE_URLS.dishwasher,
    microwave: GENERIC_IMAGE_URLS.microwave,
    lighting: GENERIC_IMAGE_URLS.lighting,
    vanity: GENERIC_IMAGE_URLS.vanity,
    basin: GENERIC_IMAGE_URLS.basin,
    "basin-mixer": GENERIC_IMAGE_URLS.tapware,
    "shower-mixer": GENERIC_IMAGE_URLS.showerMixer,
    "shower-outlet": GENERIC_IMAGE_URLS.showerMixer,
    "shower-screen": GENERIC_IMAGE_URLS.showerScreen,
    bath: GENERIC_IMAGE_URLS.bath,
    toilet: GENERIC_IMAGE_URLS.toilets,
    mirror: GENERIC_IMAGE_URLS.mirror,
    accessories: GENERIC_IMAGE_URLS.bathroomAccessories,
    "floor-tiles": GENERIC_IMAGE_URLS.tiles,
    "wall-tiles": `${GENERIC_IMAGE_URLS.tiles}&crop=entropy`,
    "feature-tiles": `${GENERIC_IMAGE_URLS.tiles}&sat=-20`,
    tub: GENERIC_IMAGE_URLS.laundryTub,
    tiles: GENERIC_IMAGE_URLS.tiles,
    tapware: GENERIC_IMAGE_URLS.tapware,
    joinery: GENERIC_IMAGE_URLS.joinery,
    "door-motor": GENERIC_IMAGE_URLS.doorMotor,
    "internal-access": GENERIC_IMAGE_URLS.externalDoors,
    "floor-finish": GENERIC_IMAGE_URLS.garageFloor,
    patio: GENERIC_IMAGE_URLS.patio,
    stairs: GENERIC_IMAGE_URLS.stairs,
    "pool-finish": GENERIC_IMAGE_URLS.poolFinish,
    coping: GENERIC_IMAGE_URLS.coping,
    fencing: GENERIC_IMAGE_URLS.poolFencing,
    surrounds: GENERIC_IMAGE_URLS.pool,
    equipment: GENERIC_IMAGE_URLS.poolEquipment,
  };
  return byCategory[key] || TOP_LEVEL_AREAS.find((areaItem) => areaItem.key === topLevelArea)?.image || GENERIC_IMAGE_URLS.exterior;
}

function family(config) {
  const approvedSourceKey = `approved-family:${config.familyKey}`;
  return {
    linkedQuoteItemCode: "",
    approvedSourceKey,
    ...config,
  };
}

function normaliseSourceRow(row) {
  const taxonomyCategory = findTaxonomyCategory(row);
  const familyItem = findProductFamily(row);
  const isProductFamily = Boolean(familyItem) || /RANGE|COLOUR|COLOR|STONE|BRICK|DOOR|ROOF|OVEN|COOKTOP|TILE|TAP|MIXER|PC SUM|ALLOWANCE/i.test(row.itemDescription);
  return {
    ...row,
    originalQuoteItemCode: row.originalQuoteItemCode || "",
    approvedSourceKey: row.originalQuoteItemCode || `csv-row-${row.sourceRow}`,
    familyKey: familyItem?.familyKey || "",
    familyDisplayName: familyItem?.displayName || "",
    topLevelArea: familyItem?.topLevelArea || taxonomyCategory?.topLevelArea || "",
    selectionArea: taxonomyCategory?.topLevelArea || familyItem?.topLevelArea || "",
    selectionCategory: taxonomyCategory?.category || familyItem?.category || "",
    selectionSubcategory: taxonomyCategory?.subcategory || familyItem?.subcategory || "",
    isProductFamily,
  };
}

function findTaxonomyCategory(row) {
  const haystack = sourceHaystack(row);
  const ranked = TAXONOMY_CATEGORY_DEFINITIONS
    .map((definition) => ({ definition, score: matcherScore(definition.sourceMatchers, haystack) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);
  return ranked[0]?.definition || null;
}

function findProductFamily(row) {
  const haystack = sourceHaystack(row);
  const ranked = PRODUCT_FAMILIES
    .map((familyItem) => ({ familyItem, score: matcherScore(familyItem.sourceMatchers, haystack) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || right.familyItem.sourceMatchers.length - left.familyItem.sourceMatchers.length);
  return ranked[0]?.familyItem || null;
}

function sourceRowMatchesFamily(row, familyItem) {
  return matcherScore(familyItem.sourceMatchers, sourceHaystack(row)) > 0;
}

function matcherScore(matchers = [], haystack = "") {
  return matchers.reduce((score, matcher) => (haystack.includes(String(matcher).toUpperCase()) ? score + String(matcher).length : score), 0);
}

function sourceHaystack(row) {
  return [row.section, row.category, row.subcategory, row.itemDescription, row.unit].filter(Boolean).join(" ").toUpperCase();
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

function titleCase(value) {
  const trimmed = String(value || "").trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return trimmed
    .toLowerCase()
    .split(" ")
    .map((word) => {
      if (/^(pc|m2|lm|mm|rc)$/.test(word)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function slug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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

function isValidUrl(value) {
  try {
    const url = new URL(String(value));
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function productEntityComparable(entity) {
  const comparable = {
    productCode: entity.productCode || entity.product_code || entity.sku || "",
    organisationId: entity.organisationId || entity.workspace_id || "",
    linkedQuoteItemCode: entity.linkedQuoteItemCode || entity.linked_quote_item_code || "",
    familyKey: entity.familyKey || entity.product_family || "",
    supplier: entity.supplier || entity.supplier_name || "",
    brand: entity.brand || "",
    range: entity.range || "",
    model: entity.model || "",
    productName: entity.productName || entity.product_name || "",
    description: entity.description || "",
    colour: entity.colour || "",
    finish: entity.finish || "",
    size: entity.size || "",
    width: entity.width || entity.dimensions?.width || "",
    height: entity.height || entity.dimensions?.height || "",
    depth: entity.depth || entity.dimensions?.depth || "",
    primaryImage: entity.primaryImage || entity.primary_image || "",
    officialProductURL: entity.officialProductURL || entity.official_product_url || "",
    specificationURL: entity.specificationURL || entity.specification_url || "",
    supplierURL: entity.supplierURL || entity.supplier_url || "",
    RRP: moneyNumber(entity.RRP || entity.rrp),
    builderCost: moneyNumber(entity.builderCost || entity.builder_cost),
    clientPrice: moneyNumber(entity.clientPrice || entity.client_price),
    currency: entity.currency || "AUD",
    gstTreatment: entity.gstTreatment || entity.gst_treatment || "GST inclusive",
    priceEffectiveDate: entity.priceEffectiveDate || entity.price_effective_date || entity.effectiveDate || "",
    active: boolValue(entity.active, true),
    discontinued: boolValue(entity.discontinued, false),
  };
  return JSON.stringify(comparable);
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
