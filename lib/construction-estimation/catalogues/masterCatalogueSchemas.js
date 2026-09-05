export const CATALOGUE_SCHEMA_VERSION = 1;

export const PRODUCT_RECORD_TYPE = "product";
export const ESTIMATING_ITEM_RECORD_TYPE = "estimating-item";

export const ProductRecord = Object.freeze({
  recordType: PRODUCT_RECORD_TYPE,
  identityField: "id",
  requiredFields: ["id", "recordType", "familyId", "name"],
  clientSelectable: true,
});

export const EstimatingItemRecord = Object.freeze({
  recordType: ESTIMATING_ITEM_RECORD_TYPE,
  identityField: "id",
  requiredFields: ["id", "recordType", "categoryId", "resourceType", "name"],
  clientSelectable: false,
});

export const QuotationSourceReference = Object.freeze({
  requiredFields: ["sourceType", "sourceId", "sourceVersion", "categoryId", "subcategoryId"],
  sourceTypes: ["product", "estimating-item", "assembly", "custom"],
});

export const QuotationSnapshot = Object.freeze({
  requiredFields: ["sourceType", "sourceId", "sourceVersion", "description", "snapshotAt"],
  frozenFields: ["description", "imagePath", "unit", "cost", "sellPrice", "gstTreatment", "selectedOptions"],
});

export const QUOTATION_SOURCE_TYPES = ["product", "estimating-item", "assembly", "custom"];
export const CATALOGUE_CLASSIFICATIONS = [
  "product",
  "estimating-item",
  "assembly",
  "heading",
  "formula",
  "allowance",
  "custom",
  "unresolved",
];

export const ESTIMATING_RESOURCE_TYPES = [
  "labour",
  "subcontract",
  "plant",
  "construction-material",
  "preliminary",
  "statutory-fee",
  "service",
  "allowance",
];

export const PRODUCT_LIBRARY_IMPORT_COLUMNS = [
  "category_id",
  "subcategory_id",
  "family_id",
  "supplier",
  "brand",
  "range",
  "product_code",
  "name",
  "description",
  "unit",
  "cost_price",
  "sell_price",
  "gst_treatment",
  "colours",
  "finishes",
  "sizes",
  "specifications",
  "warranty",
  "image_url",
  "source_url",
  "client_selectable",
  "applicable_rooms",
  "active",
];

export const ESTIMATING_CATALOGUE_IMPORT_COLUMNS = [
  "category_id",
  "subcategory_id",
  "resource_type",
  "trade",
  "code",
  "name",
  "description",
  "unit",
  "cost_rate",
  "sell_rate",
  "gst_treatment",
  "default_markup",
  "supplier_or_subcontractor",
  "region",
  "effective_from",
  "active",
];

const PRODUCT_LIKE_TERMS = [
  "oven",
  "cooktop",
  "rangehood",
  "dishwasher",
  "microwave",
  "fridge",
  "refrigerator",
  "sink",
  "mixer",
  "tap",
  "basin",
  "toilet",
  "bath",
  "shower",
  "handle",
  "door",
  "window",
  "garage door",
  "benchtop",
  "stone",
  "tile",
  "brick",
  "roof tile",
  "light fitting",
  "pendant",
];

const ESTIMATING_LIKE_TERMS = [
  "labour",
  "labor",
  "install",
  "installation",
  "hire",
  "excavat",
  "bobcat",
  "crane",
  "scaffold",
  "supervision",
  "certification",
  "engineering",
  "permit",
  "fee",
  "waterproof",
  "concrete pump",
  "pumping",
  "framing",
  "fixing",
  "waste",
  "clean",
  "temporary",
  "prelim",
];

const TRADE_RESOURCE_TERMS = {
  labour: ["labour", "labor", "carpenter", "plumber", "electrician", "painter", "tiler", "bricklayer", "roofer"],
  subcontract: ["subcontract", "contractor", "quote"],
  plant: ["hire", "excavator", "bobcat", "crane", "scaffold", "machine"],
  "construction-material": ["concrete", "timber", "steel", "reinforcement", "mesh", "fixing", "material"],
  preliminary: ["prelim", "site establishment", "supervision", "temporary", "waste", "clean"],
  "statutory-fee": ["certification", "approval", "permit", "council", "fee", "engineering"],
  service: ["service", "connection", "delivery", "inspection"],
  allowance: ["allowance", "pc item", "provisional sum"],
};

export function normalizeProductRecord(input = {}) {
  const productCode = text(input.productCode ?? input.product_code ?? input.sku);
  const id = text(input.id ?? input.productId ?? input.product_id ?? productCode);
  return {
    id,
    recordType: PRODUCT_RECORD_TYPE,
    categoryId: stableId(input.categoryId ?? input.category_id ?? input.category ?? input.categoryKey),
    subcategoryId: stableId(input.subcategoryId ?? input.subcategory_id ?? input.subcategory),
    familyId: stableId(input.familyId ?? input.family_id ?? input.familyKey ?? input.productFamily ?? input.selection_type),
    supplierId: stableId(input.supplierId ?? input.supplier_id ?? input.supplier),
    brandId: stableId(input.brandId ?? input.brand_id ?? input.brand ?? input.manufacturer),
    rangeId: stableId(input.rangeId ?? input.range_id ?? input.range ?? input.collection),
    productCode,
    name: text(input.name ?? input.productName ?? input.product_name),
    description: text(input.description),
    unit: text(input.unit ?? input.unitOfMeasure ?? input.priceUnit ?? input.price_unit ?? "EACH").toUpperCase(),
    active: booleanValue(input.active, true),
    archived: booleanValue(input.archived, false),
    clientSelectable: booleanValue(input.clientSelectable ?? input.client_selectable ?? input.builder_selectable, true),
    applicableRooms: list(input.applicableRooms ?? input.applicable_rooms ?? input.relevantRooms ?? input.requirementKeys),
    imagePath: text(input.imagePath ?? input.image_path ?? input.imageUrl ?? input.primaryImageUrl ?? input.primary_image_url),
    sourceUrl: text(input.sourceUrl ?? input.source_url ?? input.officialProductUrl ?? input.official_product_url ?? input.supplierUrl),
    schemaVersion: numberValue(input.schemaVersion ?? input.schema_version, CATALOGUE_SCHEMA_VERSION),
    updatedAt: isoValue(input.updatedAt ?? input.updated_at ?? input.priceVerifiedAt ?? input.price_verified_at),
    costPrice: nullableNumber(input.costPrice ?? input.cost_price ?? input.builderCost ?? input.builder_cost ?? input.tradeCost ?? input.trade_cost),
    sellPrice: nullableNumber(input.sellPrice ?? input.sell_price ?? input.clientPrice ?? input.client_price ?? input.rrp),
    gstTreatment: text(input.gstTreatment ?? input.gst_treatment ?? "GST inclusive"),
    markupRule: text(input.markupRule ?? input.markup_rule),
    pricingStatus: text(input.pricingStatus ?? input.priceStatus ?? input.price_status ?? "price_pending"),
    currency: text(input.currency || "AUD"),
    colours: list(input.colours ?? input.colors ?? input.colour ?? input.color),
    finishes: list(input.finishes ?? input.finish),
    sizes: list(input.sizes ?? input.size),
    specifications: normalizeSpecifications(input.specifications ?? input.specs ?? input.attributes),
    warranty: text(input.warranty ?? input.warranty_summary),
    availability: text(input.availability ?? input.availabilityStatus ?? (input.discontinued ? "discontinued" : "active")),
    region: list(input.region ?? input.regions ?? "QLD"),
  };
}

export function normalizeEstimatingItemRecord(input = {}) {
  const code = text(input.code ?? input.itemCode ?? input.item_code ?? input.sku);
  const resourceType = normalizeResourceType(input.resourceType ?? input.resource_type ?? input.tradeClassification ?? input.classification ?? inferResourceType(input));
  return {
    id: text(input.id ?? input.estimatingItemId ?? input.estimating_item_id ?? code),
    recordType: ESTIMATING_ITEM_RECORD_TYPE,
    categoryId: stableId(input.categoryId ?? input.category_id ?? input.category ?? input.section),
    subcategoryId: stableId(input.subcategoryId ?? input.subcategory_id ?? input.subcategory),
    resourceType,
    tradeId: stableId(input.tradeId ?? input.trade_id ?? input.trade ?? input.contractor),
    code,
    name: text(input.name ?? input.itemName ?? input.item_name ?? input.description),
    description: text(input.description ?? input.itemDescription ?? input.item_description ?? input.name),
    unit: text(input.unit ?? input.unitOfMeasure ?? "EACH").toUpperCase(),
    costRate: nullableNumber(input.costRate ?? input.cost_rate ?? input.unitCost ?? input.unit_cost ?? input.rate),
    sellRate: nullableNumber(input.sellRate ?? input.sell_rate ?? input.unitSell ?? input.unit_sell),
    gstTreatment: text(input.gstTreatment ?? input.gst_treatment ?? "GST inclusive"),
    defaultMarkup: nullableNumber(input.defaultMarkup ?? input.default_markup ?? input.markupPercent ?? input.markup_percent),
    supplierOrSubcontractor: text(input.supplierOrSubcontractor ?? input.supplier_or_subcontractor ?? input.supplier ?? input.subcontractor),
    region: text(Array.isArray(input.region) ? input.region[0] : input.region || "QLD"),
    effectiveFrom: text(input.effectiveFrom ?? input.effective_from),
    active: booleanValue(input.active, true),
    archived: booleanValue(input.archived, false),
    schemaVersion: numberValue(input.schemaVersion ?? input.schema_version, CATALOGUE_SCHEMA_VERSION),
    updatedAt: isoValue(input.updatedAt ?? input.updated_at),
  };
}

export function validateProductRecord(input = {}) {
  const record = input.recordType === PRODUCT_RECORD_TYPE ? input : normalizeProductRecord(input);
  const errors = [];
  const warnings = [];
  if (!record.id) errors.push("missing id");
  if (record.recordType !== PRODUCT_RECORD_TYPE) errors.push("recordType must be product");
  if (!record.familyId) errors.push("missing familyId");
  if (!record.name) errors.push("missing name");
  if (isEstimatingResourceType(record.resourceType)) errors.push("product cannot use estimating resourceType");
  if (!record.productCode && !record.archived) warnings.push("missing productCode");
  if (!record.imagePath) warnings.push("missing image");
  if (record.sellPrice == null && record.costPrice == null) warnings.push("missing price");
  if (!record.specifications || !Object.keys(record.specifications).length) warnings.push("missing specifications");
  return { valid: errors.length === 0, errors, warnings, record };
}

export function validateEstimatingItemRecord(input = {}) {
  const record = input.recordType === ESTIMATING_ITEM_RECORD_TYPE ? input : normalizeEstimatingItemRecord(input);
  const errors = [];
  const warnings = [];
  if (!record.id) errors.push("missing id");
  if (record.recordType !== ESTIMATING_ITEM_RECORD_TYPE) errors.push("recordType must be estimating-item");
  if (!record.categoryId) errors.push("missing categoryId");
  if (!record.resourceType || !ESTIMATING_RESOURCE_TYPES.includes(record.resourceType)) errors.push("invalid resourceType");
  if (!record.name) errors.push("missing name");
  if (record.clientSelectable) errors.push("estimating items cannot be clientSelectable");
  if (looksLikeSelectableProduct(record)) errors.push("selectable finished product cannot be an estimating item");
  if (record.costRate == null) warnings.push("missing costRate");
  if (!record.effectiveFrom) warnings.push("missing effectiveFrom");
  return { valid: errors.length === 0, errors, warnings, record };
}

export function getProductsForFamily(products = [], familyId) {
  const id = stableId(familyId);
  return products.map(normalizeProductRecord).filter((product) => product.familyId === id && product.active !== false && product.archived !== true);
}

export function getProductsForRoom(products = [], room) {
  const roomId = stableId(room);
  return products.map(normalizeProductRecord).filter((product) => (
    product.active !== false &&
    product.archived !== true &&
    (!product.applicableRooms.length || product.applicableRooms.map(stableId).includes(roomId))
  ));
}

export function getBrandsForFamily(products = [], familyId) {
  return Array.from(new Map(getProductsForFamily(products, familyId)
    .filter((product) => product.brandId)
    .map((product) => [product.brandId, { id: product.brandId, name: product.brandId }])).values())
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function getProductsForBrand(products = [], familyId, brandId) {
  const brand = stableId(brandId);
  return getProductsForFamily(products, familyId).filter((product) => product.brandId === brand);
}

export function classifyCatalogueRecord(input = {}) {
  const textValue = [
    input.current_description,
    input.description,
    input.item,
    input.name,
    input.section,
    input.category,
    input.lineType,
  ].filter(Boolean).join(" ").toLowerCase();
  const hasFormula = hasNonTotalFormula(input.formula || input.formulas);
  const quantity = text(input.quantity);
  const unit = text(input.unit).toLowerCase();
  if (input.heading || input.lineType === "heading" || (!quantity && !unit && !hasFormula && textValue.length < 60 && /stage|section|total|sub total|subtotal/.test(textValue))) {
    return classification("heading", "Heading or section-like row.");
  }
  if (/allowance|pc item|prime cost|provisional sum/.test(textValue)) {
    return classification("allowance", "Allowance row; do not import as a physical product.");
  }
  if (/selected|supply|install|package/.test(textValue) && containsAny(textValue, PRODUCT_LIKE_TERMS) && containsAny(textValue, ESTIMATING_LIKE_TERMS)) {
    return classification("assembly", "Likely product plus installation/resource assembly.");
  }
  if (hasFormula || /^=/.test(quantity) || /^=/.test(text(input.excelRate))) {
    return classification("formula", "Formula-driven quotation row.");
  }
  if (containsAny(textValue, PRODUCT_LIKE_TERMS) && !containsAny(textValue, ["labour", "hire", "supervision", "certification", "permit"])) {
    return classification("product", "Physical selectable or supplier product candidate.");
  }
  if (containsAny(textValue, ESTIMATING_LIKE_TERMS)) {
    return classification("estimating-item", "Labour, plant, fee, service, or construction resource candidate.");
  }
  if (input.custom || /custom|manual/.test(textValue)) {
    return classification("custom", "Custom/manual row.");
  }
  return classification("unresolved", "Insufficient deterministic evidence for automatic classification.");
}

export function createQuotationSourceReference(input = {}) {
  const sourceType = QUOTATION_SOURCE_TYPES.includes(input.sourceType) ? input.sourceType : "custom";
  return {
    sourceType,
    sourceId: text(input.sourceId),
    sourceVersion: text(input.sourceVersion ?? input.version ?? CATALOGUE_SCHEMA_VERSION),
    categoryId: stableTaxonomyId(input.categoryId ?? input.category_id, "category"),
    subcategoryId: stableTaxonomyId(input.subcategoryId ?? input.subcategory_id, "subcategory"),
  };
}

export function createQuotationSnapshot(input = {}) {
  const source = input.source || input.record || input;
  return {
    sourceType: text(input.sourceType ?? source.recordType ?? "custom"),
    sourceId: text(input.sourceId ?? source.id),
    sourceVersion: text(input.sourceVersion ?? source.sourceVersion ?? source.schemaVersion ?? CATALOGUE_SCHEMA_VERSION),
    description: text(input.description ?? source.description ?? source.name),
    imagePath: text(input.imagePath ?? source.imagePath),
    unit: text(input.unit ?? source.unit),
    cost: nullableNumber(input.cost ?? source.costPrice ?? source.costRate),
    sellPrice: nullableNumber(input.sellPrice ?? source.sellPrice ?? source.sellRate),
    gstTreatment: text(input.gstTreatment ?? source.gstTreatment),
    selectedOptions: normalizeSpecifications(input.selectedOptions ?? input.options ?? {}),
    snapshotAt: text(input.snapshotAt) || new Date().toISOString(),
  };
}

function classification(proposedSourceType, notes) {
  return { proposedSourceType, notes };
}

function normalizeResourceType(value) {
  const type = stableId(value);
  return ESTIMATING_RESOURCE_TYPES.includes(type) ? type : "service";
}

function inferResourceType(input = {}) {
  const haystack = [input.name, input.description, input.item, input.category, input.section].filter(Boolean).join(" ").toLowerCase();
  for (const [type, terms] of Object.entries(TRADE_RESOURCE_TERMS)) {
    if (containsAny(haystack, terms)) return type;
  }
  return "service";
}

function looksLikeSelectableProduct(record = {}) {
  const haystack = [record.name, record.description, record.code].filter(Boolean).join(" ").toLowerCase();
  return containsAny(haystack, PRODUCT_LIKE_TERMS) && !containsAny(haystack, ESTIMATING_LIKE_TERMS);
}

function isEstimatingResourceType(value) {
  return ESTIMATING_RESOURCE_TYPES.includes(stableId(value));
}

function containsAny(value, terms = []) {
  return terms.some((term) => value.includes(term));
}

function hasNonTotalFormula(formulas) {
  if (!formulas) return false;
  if (typeof formulas === "string") return Boolean(formulas.trim());
  if (typeof formulas !== "object") return false;
  const entries = Object.entries(formulas);
  if (!entries.length) return false;
  return entries.some(([column, formula]) => {
    const key = String(column || "").trim().toUpperCase();
    const value = String(formula || "").trim().toUpperCase();
    if ((key === "G" || key === "COST") && /^B\d+\*F\d+$/.test(value)) return false;
    return Boolean(value);
  });
}

function normalizeSpecifications(value) {
  if (!value) return {};
  if (typeof value === "string") return value.trim() ? { notes: value.trim() } : {};
  if (Array.isArray(value)) return { values: value };
  if (typeof value === "object") return { ...value };
  return {};
}

function list(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  if (value == null || value === "") return [];
  return String(value).split(/[|,;]/).map(text).filter(Boolean);
}

function stableId(value) {
  return text(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stableTaxonomyId(value, prefix) {
  const raw = text(value);
  if (!raw) return "";
  if (raw.toLowerCase().startsWith(`${prefix}:`)) return `${prefix}:${stableId(raw.slice(prefix.length + 1))}`;
  return `${prefix}:${stableId(raw)}`;
}

function booleanValue(value, fallback = false) {
  if (value === true || value === false) return value;
  const normalized = text(value).toLowerCase();
  if (["true", "yes", "y", "1", "active"].includes(normalized)) return true;
  if (["false", "no", "n", "0", "inactive"].includes(normalized)) return false;
  return fallback;
}

function numberValue(value, fallback = 0) {
  const numeric = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}

function nullableNumber(value) {
  if (value === "" || value == null) return null;
  const numeric = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function isoValue(value) {
  if (value) return text(value);
  return new Date().toISOString();
}

function text(value) {
  return String(value ?? "").trim();
}
