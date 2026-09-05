export const STAGE3_CLASSIFICATIONS = [
  "product",
  "estimating-item",
  "assembly",
  "formula",
  "allowance",
  "heading",
  "informational",
  "custom",
  "obsolete",
  "unresolved",
];

const PRODUCT_TERMS = [
  "oven",
  "cooktop",
  "hot plate",
  "rangehood",
  "range hood",
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
  "robe",
  "benchtop",
  "stone",
  "tile",
  "brick",
  "block",
  "cladding",
  "roofing",
  "gutter",
  "fascia",
  "downpipe",
  "light fitting",
  "pendant",
  "fan",
];

const ESTIMATING_TERMS = [
  "labour",
  "labor",
  "install",
  "installation",
  "supply and install",
  "supply & install",
  "fix",
  "hire",
  "excavator",
  "bobcat",
  "crane",
  "scaffold",
  "supervision",
  "certification",
  "engineering",
  "approval",
  "permit",
  "fee",
  "waterproof",
  "concrete pump",
  "pumping",
  "frame",
  "framing",
  "clean",
  "waste",
  "temporary",
  "prelim",
  "delivery",
  "connection",
  "inspection",
  "quoted amount",
  "quote",
  "plans",
  "design",
  "search",
  "planning",
  "scrutiny",
  "extras",
  "travel",
  "deliver",
  "collect",
  "demolish",
  "remove",
  "cutting",
  "jack hammer",
  "consumables",
  "surveyor",
  "set out",
  "stringline",
  "spray paint",
  "bulldozer",
  "float cost",
  "rock",
  "excavation",
  "soil removal",
  "trench mesh",
  "reinforcing",
  "deformed bar",
  "starter bar",
  "corner bar",
  "ligature",
  "chairs",
  "slab",
  "footing",
  "boundary relaxation",
  "dowell",
  "dowel",
  "plastic",
  "bedding sand",
  "crusher dust",
  "concrete",
  "mpa",
  "metal stump",
  "shs stump",
  "ant cap",
  "bearer",
  "yellow tongue",
  "tie down",
  "tensioning ring",
  "termite",
  "physical barrier",
  "reticulation",
  "chemical spray",
  "truss",
  "post support",
  "cyclone",
  "connector",
  "chemset",
  "secura",
  "adhesive",
  "joist hanger",
  "ceiling batten",
  "pine",
  "bolt",
  "nut",
  "washer",
  "screw",
  "multi grip",
  "strap",
  "stirrup",
  "dpc",
  "flashing",
  "capping",
  "sarking",
  "insulation",
  "edge protection",
  "guard",
];

const OBSOLETE_TERMS = ["obsolete", "deleted", "do not use", "superseded", "old rate", "legacy only"];
const ALLOWANCE_TERMS = ["allowance", "pc item", "prime cost", "provisional sum", "prov sum", "p/s"];
const INFORMATIONAL_TERMS = ["note", "refer", "by owner", "by client", "included elsewhere", "n/a", "na", "tbc", "tba"];
const TRADE_SECTION_TERMS = ["labour", "plumbing", "electrical", "renderer", "plasterer", "tiler", "painter", "equipment hire"];

export function classifyStage3QuotationRow(row = {}) {
  const description = row.current_description || row.item || row.description || row.rawText || "";
  const section = row.sectionLabel || row.section || "";
  const text = `${section} ${description}`.toLowerCase();
  const compact = normalizeKey(description);
  const hasFormula = hasNonSimpleFormula(row.formula || row.formulas);
  const unit = String(row.unit || "").trim();
  const quantity = String(row.quantity || "").trim();

  if (!description.trim()) return result("informational", "malformed row", "Blank item/description in imported workbook row.");
  if (compact === "item" && normalizeKey(unit) === "unit") return result("informational", "malformed row", "Repeated imported column header row; not a catalogue record.");
  if (containsAny(text, OBSOLETE_TERMS)) return result("obsolete", "legacy row", "Marked obsolete, deleted, superseded, or legacy-only.");
  if (isSubtotalOrTotal(text, compact)) return result(hasFormula ? "formula" : "heading", hasFormula ? "subtotal/formula" : "heading", "Subtotal/total/section row; not a catalogue record.");
  if (isHeadingLike({ description, unit, quantity, hasFormula })) return result("heading", "heading", "Section-like row with no useful pricing unit or quantity.");
  if (containsAny(text, ALLOWANCE_TERMS)) return result("allowance", "description/note", "Allowance or provisional row; not an actual product model.");
  if (hasFormula) return result("formula", "subtotal/formula", "Formula-driven row; keep out of master catalogues.");
  if (containsAny(text, INFORMATIONAL_TERMS)) return result("informational", "description/note", "Informational or confirmation-only row.");
  if (/custom|manual|owner supplied|client supplied/.test(text)) return result("custom", "legacy row", "Custom/manual/supplied-by-others row.");

  const productish = containsAny(text, PRODUCT_TERMS);
  const estimatingish = containsAny(text, ESTIMATING_TERMS) || containsAny(section.toLowerCase(), TRADE_SECTION_TERMS);
  if (productish && estimatingish && !/labour to install|^install\b| labour\b/.test(description.toLowerCase())) {
    return result("assembly", "ambiguous product", "Product/resource bundle; needs assembly template rather than single catalogue row.");
  }
  if (estimatingish) return result("estimating-item", "ambiguous labour/material item", "Labour, plant, service, fee, or construction resource candidate.");
  if (productish) return result("product", "ambiguous product", "Physical product/material candidate.");

  if (!categorySignal(text)) return result("unresolved", unresolvedReason({ description, section, unit, quantity }), "No reliable product, trade, category, or formula signal.");
  return result("unresolved", unresolvedReason({ description, section, unit, quantity }), "Insufficient deterministic evidence for automatic classification.");
}

export function createProductMatchIndex(products = []) {
  const byId = new Map();
  const byCode = new Map();
  const bySupplierModel = new Map();
  const byName = new Map();
  for (const product of products) {
    const normalized = normalizeProductForMatch(product);
    add(byId, normalized.id, normalized);
    add(byCode, normalized.productCode, normalized);
    add(byCode, normalized.model, normalized);
    add(bySupplierModel, [normalized.supplier, normalized.model].filter(Boolean).join(" "), normalized);
    add(bySupplierModel, [normalized.brand, normalized.model].filter(Boolean).join(" "), normalized);
    add(byName, normalized.name, normalized);
  }
  return { byId, byCode, bySupplierModel, byName, products: products.map(normalizeProductForMatch) };
}

export function matchProductRecord(row = {}, index = createProductMatchIndex()) {
  const text = `${row.current_description || row.item || ""} ${row.rawText || ""}`;
  const normalized = normalizeKey(text);
  const candidates = [];
  const directFields = [row.proposed_source_id, row.sourceProductId, row.productId, row.productCode, row.model].map(normalizeKey).filter(Boolean);
  for (const value of directFields) {
    if (index.byId.has(value)) candidates.push({ ...index.byId.get(value), confidence: "stable-id", field: "id" });
    if (index.byCode.has(value)) candidates.push({ ...index.byCode.get(value), confidence: "product-code", field: "code" });
  }
  for (const product of index.products || []) {
    if (product.productCode && normalized.includes(product.productCode)) candidates.push({ ...product, confidence: "product-code-in-description", field: "description" });
    else if (product.model && normalized.includes(product.model) && (normalized.includes(product.supplier) || normalized.includes(product.brand))) candidates.push({ ...product, confidence: "supplier-model", field: "description" });
    else if (product.name && normalizeKey(product.name).length > 10 && normalized === normalizeKey(product.name)) candidates.push({ ...product, confidence: "exact-name", field: "name" });
  }
  return bestUnique(candidates);
}

export function createDerivedEstimatingIndex(rows = []) {
  const byKey = new Map();
  for (const row of rows) {
    const classification = classifyStage3QuotationRow(row);
    if (!["estimating-item", "assembly", "allowance"].includes(classification.proposedSourceType)) continue;
    const key = stableCatalogueId(classification.proposedSourceType === "assembly" ? "assembly" : "estimating", row);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(row.quotation_row_id || row.id || `quote-${row.excelRow || ""}`);
  }
  return byKey;
}

export function stableCatalogueId(prefix, row = {}) {
  const category = canonicalCategoryId(row.category_id || row.categoryId || row.sectionLabel || row.section || "unassigned");
  const subcategory = canonicalSubcategoryId(row.subcategory_id || row.subcategoryId || row.current_description || row.item || "unassigned");
  const description = normalizeKey(row.current_description || row.item || row.description || row.rawText || "row");
  return `${prefix}:${category.replace("category:", "")}:${subcategory.replace("subcategory:", "")}:${description}`;
}

export function duplicateKeyFor(row = {}) {
  const sourceType = row.proposed_source_type || row.proposedSourceType || "unresolved";
  if (["formula", "heading", "informational", "obsolete", "unresolved"].includes(sourceType)) return "";
  return stableCatalogueId(sourceType === "product" ? "product" : sourceType === "assembly" ? "assembly" : "estimating", row);
}

export function reviewDuplicateGroups(rows = []) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.duplicate_group || duplicateKeyFor(row);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return Array.from(groups.entries())
    .filter(([, groupRows]) => groupRows.length > 1)
    .map(([key, groupRows]) => duplicateReview(key, groupRows))
    .sort((left, right) => right.duplicate_count - left.duplicate_count || left.duplicate_group.localeCompare(right.duplicate_group));
}

export function unresolvedReasonFor(row = {}) {
  if (row.unresolved_reason) return row.unresolved_reason;
  const classified = classifyStage3QuotationRow(row);
  if (classified.proposedSourceType !== "unresolved") return classified.unresolvedReason;
  return classified.unresolvedReason || "genuinely unresolved";
}

export function normalizeKey(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

export function canonicalCategoryId(value = "") {
  return withPrefix(value, "category");
}

export function canonicalSubcategoryId(value = "") {
  return withPrefix(value, "subcategory");
}

function result(proposedSourceType, unresolvedReason, notes) {
  return { proposedSourceType, unresolvedReason, notes };
}

function normalizeProductForMatch(product = {}) {
  return {
    source: product.source || "",
    id: normalizeKey(product.productId || product.id || product.product_id || ""),
    productId: product.productId || product.id || product.product_id || "",
    productCode: normalizeKey(product.productCode || product.product_code || product.sku || ""),
    displayProductCode: product.productCode || product.product_code || product.sku || "",
    model: normalizeKey(product.model || product.model_number || product.productCode || product.product_code || ""),
    supplier: normalizeKey(product.supplier || product.supplier_name || ""),
    brand: normalizeKey(product.brand || product.manufacturer || ""),
    name: product.productName || product.product_name || product.name || product.colourName || "",
  };
}

function duplicateReview(key, rows) {
  const canonical = rows.slice().sort((left, right) => Number(left.quotation_code || left.excelRow || 0) - Number(right.quotation_code || right.excelRow || 0))[0];
  const units = new Set(rows.map((row) => String(row.unit || row.unit_of_measure || "").trim()).filter(Boolean));
  const prices = new Set(rows.map((row) => String(row.excelRate || row.rate || row.sell_price || "").trim()).filter(Boolean));
  const sections = new Set(rows.map((row) => String(row.stage_id || row.sectionLabel || row.section || "").trim()).filter(Boolean));
  const contextVariant = sections.size > 1 || /ground|second|third|upper|lower|bath|ensuite|kitchen|laundry|external|internal/i.test(rows.map((row) => row.current_description || row.item || "").join(" "));
  return {
    duplicate_group: key,
    canonical_row_id: canonical.quotation_row_id || canonical.id || "",
    duplicate_row_ids: rows.filter((row) => row !== canonical).map((row) => row.quotation_row_id || row.id || "").join("|"),
    duplicate_count: rows.length,
    review_type: contextVariant ? "room/context variant" : "true duplicate candidate",
    proposed_stable_catalogue_id: canonical.proposed_source_id || stableCatalogueId("catalogue", canonical),
    recommended_action: contextVariant ? "keep separate rows; map to one catalogue item with row context/snapshot" : "review for later merge after price/unit validation",
    price_unit_conflict: units.size > 1 || prices.size > 1 ? "yes" : "no",
    units: Array.from(units).join("|"),
    prices: Array.from(prices).join("|"),
    notes: contextVariant ? "Repeated description appears in multiple sections, levels, rooms, or contexts." : "Repeated description appears to share one catalogue identity.",
  };
}

function bestUnique(candidates) {
  if (!candidates.length) return null;
  const priority = ["stable-id", "product-code", "product-code-in-description", "supplier-model", "exact-name"];
  candidates.sort((left, right) => priority.indexOf(left.confidence) - priority.indexOf(right.confidence));
  const best = candidates[0];
  const sameRank = candidates.filter((item) => item.confidence === best.confidence);
  if (sameRank.length > 1 && new Set(sameRank.map((item) => item.productId || item.id)).size > 1) {
    return { ...best, confidence: "ambiguous", ambiguousCount: sameRank.length };
  }
  return best;
}

function add(map, key, value) {
  const normalized = normalizeKey(key);
  if (normalized && !map.has(normalized)) map.set(normalized, value);
}

function containsAny(value, terms) {
  return terms.some((term) => value.includes(term));
}

function categorySignal(text) {
  return containsAny(text, [...PRODUCT_TERMS, ...ESTIMATING_TERMS, ...ALLOWANCE_TERMS, ...INFORMATIONAL_TERMS]);
}

function isSubtotalOrTotal(text, compact) {
  return /\b(subtotal|sub total|total|margin|markup|gst)\b/.test(text) || ["subtotal", "total"].includes(compact);
}

function isHeadingLike({ description, unit, quantity, hasFormula }) {
  const trimmed = description.trim();
  if (hasFormula || unit || quantity) return false;
  if (trimmed.length <= 3) return true;
  return trimmed === trimmed.toUpperCase() && trimmed.length < 60;
}

function hasNonSimpleFormula(formulas) {
  if (!formulas) return false;
  if (typeof formulas === "string") return Boolean(formulas.trim());
  if (typeof formulas !== "object") return false;
  return Object.entries(formulas).some(([column, formula]) => {
    const key = String(column || "").trim().toUpperCase();
    const value = String(formula || "").trim().toUpperCase();
    if ((key === "G" || key === "COST") && /^B\d+\*F\d+$/.test(value)) return false;
    return Boolean(value);
  });
}

function withPrefix(value, prefix) {
  const raw = String(value || "").trim();
  if (!raw) return `${prefix}:unassigned`;
  if (raw.toLowerCase().startsWith(`${prefix}:`)) return `${prefix}:${normalizeKey(raw.slice(prefix.length + 1))}`;
  return `${prefix}:${normalizeKey(raw)}`;
}

function unresolvedReason({ description, section, unit, quantity }) {
  const text = `${section || ""} ${description || ""}`.toLowerCase();
  const compact = normalizeKey(description);
  if (!description || (compact === "item" && normalizeKey(unit) === "unit")) return "malformed row";
  if (/misc|ungrouped|extras|old|legacy/.test(text)) return "legacy row";
  if (/note|refer|tbc|tba|confirm/.test(text)) return "description/note";
  if (/total|subtotal|margin|markup/.test(text)) return "subtotal/formula";
  if (unit && unit !== "ITEM") return "ambiguous labour/material item";
  if (/^[a-z]*\d+[a-z\d -]*$/i.test(String(description || "").trim())) return "ambiguous product";
  if (!section || /ungrouped|unassigned/i.test(section)) return "missing category";
  if (quantity && normalizeKey(quantity) === "qty") return "malformed row";
  return "genuinely unresolved";
}
