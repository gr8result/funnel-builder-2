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
  requirement("roof", "Roof", "metal-roofing", 0, "ITEM", 1, "exterior", "Exterior"),
  requirement("garage-door", "Garage Door", "garage-doors", 0, "EACH", 1, "exterior", "Exterior"),
  requirement("entry-door", "Entry Door", "entry-doors", 0, "EACH", 1, "exterior", "Exterior"),
];

export const INTERIOR_REQUIREMENTS = [
  requirement("internal-doors", "Internal Doors", "internal-doors", 0, "EACH", 1, "interior", "Interior"),
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
    if (entity.organisationId && product.organisationId && entity.organisationId !== product.organisationId) return false;
    const explicitArea = entity.topLevelArea || product.topLevelArea || product.metadata?.topLevelArea;
    const explicitFamily = entity.familyKey || product.familyKey || product.metadata?.familyKey;
    const quoteCode = entity.linkedQuoteItemCode || product.linkedQuoteItemCode || product.quote_structure_row_id;
    const matchesRequiredQuote = !requirement.linkedQuoteItemCode || !quoteCode || quoteCode === requirement.linkedQuoteItemCode || quoteCode === family.linkedQuoteItemCode || quoteCode === family.approvedSourceKey;
    return (explicitArea ? explicitArea === requirement.areaKey : true) && (explicitFamily ? explicitFamily === requirement.familyKey : productMatchesFamily(entity, family)) && matchesRequiredQuote;
  });
}

export function requirementImage(requirement, product = null) {
  return product?.primaryImage || product?.primary_image_url || product?.metadata?.productEntity?.primaryImage || familyByKey(requirement?.familyKey)?.image || GENERIC_IMAGE_URLS[requirement?.imageKey] || GENERIC_IMAGE_URLS.kitchen;
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

function filterKeys(requirement) {
  if (requirement.familyKey === "ovens") return ["brand", "width", "fuelType", "finish"];
  if (requirement.familyKey === "stone-benchtops") return ["supplier", "range", "colour"];
  if (["kitchen-sinks", "kitchen-sink-mixers"].includes(requirement.familyKey)) return ["supplier", "brand", "range", "finish"];
  if (requirement.familyKey === "cooktops") return ["brand", "width", "fuelType", "finish"];
  return ["supplier", "brand", "range", "colour", "finish"];
}

function requirement(requirementKey, label, familyKey, defaultAllowance, unit = "EACH", defaultQuantity = 1, areaKey = KITCHEN_AREA_KEY, areaLabel = KITCHEN_AREA_LABEL) {
  return {
    areaKey,
    areaLabel,
    requirementKey,
    label,
    familyKey,
    defaultAllowance,
    unit,
    defaultQuantity,
    imageKey: familyKey,
  };
}

function titleLabel(value) {
  return String(value || "").replace(/([A-Z])/g, " $1").replace(/\b\w/g, (letter) => letter.toUpperCase()).trim();
}
