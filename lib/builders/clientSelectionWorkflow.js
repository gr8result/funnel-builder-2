import {
  GENERIC_IMAGE_URLS,
  familyByKey,
  productMatchesFamily,
  selectionKeyForFamily,
} from "../product-library/catalogueModel.js";
import { numberValue, roundMoney } from "./selectionBudget.js";

export const KITCHEN_AREA_KEY = "kitchen";
export const KITCHEN_AREA_LABEL = "Kitchen";

export const KITCHEN_REQUIREMENTS = [
  requirement("cabinetry", "Cabinetry", "cabinetry", 2500, "ITEM"),
  requirement("cabinet-finish", "Cabinet Finish", "cabinet-finish", 1200, "ITEM"),
  requirement("handles", "Handles", "handles", 350, "EACH", 24),
  requirement("benchtop", "Benchtop", "stone-benchtops", 3200, "M2", 8),
  requirement("splashback", "Splashback", "splashback", 900, "M2", 4),
  requirement("sink", "Sink", "kitchen-sinks", 650, "EACH"),
  requirement("sink-mixer", "Sink Mixer", "kitchen-sink-mixers", 420, "EACH"),
  requirement("oven", "Oven", "ovens", 1200, "EACH"),
  requirement("cooktop", "Cooktop", "cooktops", 950, "EACH"),
  requirement("rangehood", "Rangehood", "rangehoods", 650, "EACH"),
  requirement("dishwasher", "Dishwasher", "dishwashers", 1000, "EACH"),
  requirement("microwave", "Microwave", "microwaves", 450, "EACH"),
  requirement("flooring", "Flooring", "flooring", 1400, "M2", 18),
  requirement("lighting", "Lighting", "lighting", 700, "ITEM"),
  requirement("paint", "Paint", "paint", 600, "ITEM"),
];

export const EXTERIOR_REQUIREMENTS = [
  requirement("bricks", "Bricks", "bricks", 0, "ITEM", 1, "exterior", "Exterior"),
  requirement("cladding", "Cladding", "visual-cladding", 0, "ITEM", 1, "exterior", "Exterior", "cladding"),
  requirement("roofing", "Roofing", "metal-roofing", 0, "ITEM", 1, "exterior", "Exterior", "roofing"),
  requirement("windows", "Windows", "visual-windows", 0, "ITEM", 1, "exterior", "Exterior", "windows"),
  requirement("entry-door", "Entry Doors", "entry-doors", 0, "EACH", 1, "exterior", "Exterior", "entryDoors"),
  requirement("garage-door", "Garage Doors", "garage-doors", 0, "EACH", 1, "exterior", "Exterior", "garageDoors"),
  requirement("gutters-fascia", "Gutters & Fascia", "metal-roofing", 0, "ITEM", 1, "exterior", "Exterior", "gutters"),
  requirement("balustrades", "Balustrades", "visual-balustrades", 0, "ITEM", 1, "exterior", "Exterior", "balustrades"),
  requirement("external-lighting", "External Lighting", "visual-external-lighting", 0, "ITEM", 1, "exterior", "Exterior", "externalLighting"),
  requirement("exterior-paint", "Exterior Paint", "visual-exterior-paint", 0, "ITEM", 1, "exterior", "Exterior", "exteriorPaint"),
  requirement("driveway", "Driveway", "visual-driveway", 0, "ITEM", 1, "exterior", "Exterior", "drivewayFinishes"),
  requirement("decking", "Decking", "visual-decking", 0, "ITEM", 1, "exterior", "Exterior", "decking"),
  requirement("pool", "Pool", "visual-pool", 0, "ITEM", 1, "exterior", "Exterior", "pool"),
  requirement("retaining-walls", "Retaining Walls", "visual-retaining-walls", 0, "ITEM", 1, "exterior", "Exterior", "outdoor"),
  requirement("landscaping", "Landscaping", "visual-landscaping", 0, "ITEM", 1, "exterior", "Exterior", "outdoor"),
];

export const INTERIOR_REQUIREMENTS = [
  requirement("kitchen", "Kitchen", "visual-kitchen", 0, "ITEM", 1, "interior", "Interior", "kitchen"),
  requirement("bathroom", "Bathroom", "visual-bathroom", 0, "ITEM", 1, "interior", "Interior", "bathroom"),
  requirement("ensuite", "Ensuite", "visual-ensuite", 0, "ITEM", 1, "interior", "Interior", "bathroom"),
  requirement("laundry", "Laundry", "visual-laundry", 0, "ITEM", 1, "interior", "Interior", "laundry"),
  requirement("bedroom", "Bedroom", "flooring", 0, "ITEM", 1, "interior", "Interior", "bedrooms"),
  requirement("living", "Living", "flooring", 0, "ITEM", 1, "interior", "Interior", "living"),
  requirement("internal-doors", "Internal Doors", "internal-doors", 0, "EACH", 1, "interior", "Interior", "internalDoors"),
  requirement("interior-flooring", "Flooring", "flooring", 0, "M2", 1, "interior", "Interior", "flooring"),
  requirement("interior-paint", "Paint", "visual-interior-paint", 0, "ITEM", 1, "interior", "Interior", "paint"),
  requirement("interior-lighting", "Lighting", "visual-interior-lighting", 0, "ITEM", 1, "interior", "Interior", "lighting"),
];

export const ALL_GUIDED_REQUIREMENTS = [
  ...KITCHEN_REQUIREMENTS,
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

const PRODUCT_STATUS_FIELDS = ["priceStatus", "price_status", "model_status"];
const EXACT_IMAGE_FIELDS = ["primaryImage", "primary_image_url", "exactImageURL", "exact_image_url", "imageUrl", "image_url"];
const VARIANT_IMAGE_FIELDS = ["variantImage", "variant_image_url", "colourImage", "colour_image_url", "swatchImage", "swatch_image_url"];
const RANGE_IMAGE_FIELDS = ["rangeImage", "range_image_url", "thumbnail", "thumbnailURL", "genericCategoryImage"];
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
  return (
    metadata.area === requirement.areaKey ||
    details.area === requirement.areaKey ||
    selection.room?.toLowerCase() === requirement.areaKey
  ) && (
    metadata.requirementKey === requirement.requirementKey ||
    details.requirementKey === requirement.requirementKey ||
    metadata.familyKey === requirement.familyKey ||
    details.familyKey === requirement.familyKey
  );
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
  return numberValue(entity.clientPrice ?? product.clientPrice ?? product.upgrade_cost ?? product.client_selection_price);
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
  if (!family) return [];
  return products.filter((product) => {
    const entity = product.metadata?.productEntity || product;
    const rowType = entity.rowClassification || product.rowClassification || product.metadata?.rowClassification || classifyApprovedSelectionRow(entity);
    if (requirement?.areaKey === "exterior" && [CLASSIFICATION_TYPES.allowanceSpecification, CLASSIFICATION_TYPES.variant].includes(rowType)) return false;
    if (entity.organisationId && product.organisationId && entity.organisationId !== product.organisationId) return false;
    const explicitArea = entity.topLevelArea || product.topLevelArea || product.metadata?.topLevelArea;
    const explicitFamily = entity.familyKey || product.familyKey || product.metadata?.familyKey;
    const quoteCode = entity.linkedQuoteItemCode || product.linkedQuoteItemCode || product.quote_structure_row_id;
    const matchesRequiredQuote = !requirement.linkedQuoteItemCode || !quoteCode || quoteCode === requirement.linkedQuoteItemCode || quoteCode === family.linkedQuoteItemCode || quoteCode === family.approvedSourceKey;
    return (explicitArea ? explicitArea === requirement.areaKey : true) && (explicitFamily ? explicitFamily === requirement.familyKey : productMatchesFamily(entity, family)) && matchesRequiredQuote;
  });
}

export function requirementImage(requirement, product = null) {
  return resolveSelectionImage({ product, requirement });
}

export function resolveSelectionImage({ product = null, requirement = null, exactProductImage = "", exactRangeImage = "", familyKey = "", categoryKey = "", areaKey = "" } = {}) {
  const entity = product?.metadata?.productEntity || product || {};
  const exactImage = exactProductImage || firstField(entity, EXACT_IMAGE_FIELDS) || firstField(product || {}, EXACT_IMAGE_FIELDS);
  if (exactImage) return exactImage;
  const variantImage = firstField(entity, VARIANT_IMAGE_FIELDS) || firstField(product || {}, VARIANT_IMAGE_FIELDS);
  if (variantImage) return variantImage;
  const rangeImage = exactRangeImage || firstField(entity, RANGE_IMAGE_FIELDS) || firstField(product || {}, RANGE_IMAGE_FIELDS);
  if (rangeImage) return rangeImage;
  const resolvedFamilyKey = familyKey || requirement?.familyKey || entity.familyKey || product?.familyKey;
  if (resolvedFamilyKey === "bricks") return brickSelectionPlaceholderImage();
  const familyImage = familyByKey(resolvedFamilyKey)?.image;
  if (familyImage) return familyImage;
  const imageKey = categoryKey || requirement?.imageKey || requirement?.requirementKey || entity.categoryKey || entity.requirementKey;
  if (imageKey && GENERIC_IMAGE_URLS[imageKey]) return GENERIC_IMAGE_URLS[imageKey];
  const areaImage = areaKey || requirement?.areaKey || entity.topLevelArea || product?.topLevelArea;
  if (areaImage && GENERIC_IMAGE_URLS[areaImage]) return GENERIC_IMAGE_URLS[areaImage];
  return placeholderSelectionImage(requirement?.label || entity.category || entity.productName || "Selection");
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
  const selectedPrice = complete ? rawSelectedPrice : 0;
  const variation = complete ? variationFor({ selectedPrice, allowance, quantity: selectedQuantity }) : 0;
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
      selectedPrice,
      allowance,
      quantity: selectedQuantity,
      unit: requirement.unit,
      variationAmount: variation,
      priceState,
      selectedVariant: entity.variants?.[0] || null,
    },
    status: complete ? "selected" : "pending",
    selected_at: new Date().toISOString(),
    metadata: {
      source: "client_selection_checklist",
      area: requirement.areaKey,
      requirementKey: requirement.requirementKey,
      familyKey: requirement.familyKey,
      priceState,
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
    selection_status: complete ? "selected" : "not_selected",
    is_included_selection: variation === 0,
    is_active: true,
  };
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

function brickSelectionPlaceholderImage() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600"><rect width="900" height="600" fill="#f3f0ea"/><g transform="translate(72 70)"><rect width="756" height="460" rx="18" fill="#fffaf2" stroke="#d7c2aa" stroke-width="4"/><g fill="#b6543f" stroke="#8f3d2f" stroke-width="3"><rect x="58" y="62" width="132" height="54" rx="5"/><rect x="204" y="62" width="132" height="54" rx="5"/><rect x="350" y="62" width="132" height="54" rx="5"/><rect x="496" y="62" width="132" height="54" rx="5"/><rect x="131" y="130" width="132" height="54" rx="5"/><rect x="277" y="130" width="132" height="54" rx="5"/><rect x="423" y="130" width="132" height="54" rx="5"/><rect x="569" y="130" width="92" height="54" rx="5"/><rect x="58" y="198" width="132" height="54" rx="5"/><rect x="204" y="198" width="132" height="54" rx="5"/><rect x="350" y="198" width="132" height="54" rx="5"/><rect x="496" y="198" width="132" height="54" rx="5"/></g><g fill="#d08a63" opacity=".85"><circle cx="104" cy="85" r="8"/><circle cx="252" cy="224" r="7"/><circle cx="454" cy="87" r="6"/><circle cx="536" cy="152" r="8"/><circle cx="592" cy="222" r="6"/></g><text x="378" y="358" text-anchor="middle" font-family="Arial" font-size="34" font-weight="800" fill="#633326">Brick image pending</text><text x="378" y="398" text-anchor="middle" font-family="Arial" font-size="19" fill="#8a5a48">Import exact swatches for visual selection</text></g></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function filterKeys(requirement) {
  if (requirement.familyKey === "ovens") return ["brand", "width", "fuelType", "finish"];
  if (requirement.familyKey === "stone-benchtops") return ["supplier", "range", "colour"];
  if (["kitchen-sinks", "kitchen-sink-mixers"].includes(requirement.familyKey)) return ["supplier", "brand", "range", "finish"];
  if (requirement.familyKey === "cooktops") return ["brand", "width", "fuelType", "finish"];
  return ["supplier", "brand", "range", "colour", "finish"];
}

function requirement(requirementKey, label, familyKey, defaultAllowance, unit = "EACH", defaultQuantity = 1, areaKey = KITCHEN_AREA_KEY, areaLabel = KITCHEN_AREA_LABEL, imageKey = familyKey) {
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
  };
}

function titleLabel(value) {
  return String(value || "").replace(/([A-Z])/g, " $1").replace(/\b\w/g, (letter) => letter.toUpperCase()).trim();
}
